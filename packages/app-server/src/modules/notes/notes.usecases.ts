import type { NotesRepository } from './notes.types';
import { createKeyedMutex } from '../shared/utils/keyed-mutex';
import { createNoteNotFoundError } from './notes.errors';
import { isNoteExpired } from './notes.models';

export { getRefreshedNote };

// Serialize read+delete per note id so two concurrent readers of a one-time
// ("delete after reading") note can't both be served before the delete lands.
const noteReadMutex = createKeyedMutex();

async function getRefreshedNote({
  noteId,
  notesRepository,
  now = new Date(),
}: {
  noteId: string;
  notesRepository: NotesRepository;
  now?: Date;
}) {
  return noteReadMutex.runExclusive({
    key: noteId,
    fn: async () => {
      const { note } = await notesRepository.getNoteById({ noteId });

      if (isNoteExpired({ note, now })) {
        await notesRepository.deleteNoteById({ noteId });

        throw createNoteNotFoundError();
      }

      if (note.deleteAfterReading) {
        await notesRepository.deleteNoteById({ noteId });
      }

      return {
        note,
      };
    },
  });
}
