import { useCallback, useRef, useState } from 'react';
import { removePicture, uploadPicture } from '../services/pictures';

/**
 * Picture handling for admin forms. A picture is uploaded the moment it is chosen, so this tracks
 * which ones are new and unsaved, and cleans up whatever ends up unused:
 *  - choose a different picture: the previous unsaved one is removed
 *  - cancel the form: every unsaved picture is removed
 *  - save: the picture the item used to have is removed if it was replaced
 */
export function usePictureEditor() {
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = useRef<string | null>(null);
  const original = useRef<string | null>(null);
  const uploaded = useRef<string[]>([]);

  const set = (path: string | null) => {
    current.current = path;
    setImagePath(path);
  };

  const dropIfUnsaved = async (path: string | null) => {
    if (path && uploaded.current.includes(path)) {
      await removePicture(path);
      uploaded.current = uploaded.current.filter((p) => p !== path);
    }
  };

  const reset = useCallback((initial: string | null) => {
    original.current = initial;
    uploaded.current = [];
    current.current = initial;
    setImagePath(initial);
    setError(null);
  }, []);

  const pick = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const path = await uploadPicture(file);
      await dropIfUnsaved(current.current);
      uploaded.current.push(path);
      set(path);
    } catch (err) {
      console.error('[admin] picture', err);
      setError(err instanceof Error ? err.message : 'Could not upload that picture.');
    }
    setUploading(false);
  }, []);

  const remove = useCallback(async () => {
    await dropIfUnsaved(current.current);
    set(null);
  }, []);

  const commit = useCallback(async () => {
    const old = original.current;
    uploaded.current = [];
    if (old && old !== current.current) await removePicture(old);
    original.current = current.current;
  }, []);

  const discard = useCallback(async () => {
    await Promise.all(uploaded.current.map((p) => removePicture(p)));
    uploaded.current = [];
  }, []);

  return { imagePath, uploading, error, reset, pick, remove, commit, discard };
}
