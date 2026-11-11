import type { ChangeEvent } from 'react';
import { pictureUrl } from '../../services/pictures';
import { Button } from '../../shared/components';

interface PictureFieldProps {
  imagePath: string | null;
  uploading: boolean;
  error: string | null;
  onPick: (file: File) => void;
  onRemove: () => void;
}

export function PictureField({ imagePath, uploading, error, onPick, onRemove }: PictureFieldProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onPick(file);
  }

  return (
    <div className="field">
      <span className="field__label">Picture</span>
      {imagePath && <img className="picture-preview" src={pictureUrl(imagePath)} alt="Chosen picture" />}
      <div className="ann__actions">
        <label className="btn btn--secondary picture-pick">
          {uploading ? 'Uploading…' : imagePath ? 'Change picture' : 'Choose picture'}
          <input type="file" accept="image/*" onChange={handleChange} disabled={uploading} className="visually-hidden" />
        </label>
        {imagePath && (
          <Button variant="ghost" disabled={uploading} onClick={onRemove}>
            Remove picture
          </Button>
        )}
      </div>
      <p className="field__hint">Optional. It is shrunk automatically so it loads fast and saves storage.</p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
