import { useCallback, useEffect, useRef, useState } from 'react';
import PhotoCropModal from './PhotoCropModal';
import { cropImageToFile } from '../utils/cropImage';
import './PhotoDropzone.css';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png'];

// Drag-and-drop (or click-to-browse) photo uploader with preview. Every photo
// is run through <PhotoCropModal> before it reaches onChange, so uploads are
// always cropped to a fixed ratio rather than being force-cropped by CSS
// object-fit later.
// existingUrl: server-relative path of a previously saved photo, if any
// onChange(file): called with a new (already-cropped) File when the user
//   picks/drops/re-crops one
// onRemove(): called when the user clears the current photo
// changed (optional): highlights this field the same way other import-review
// diffs are shown elsewhere in the form (see .field-group.field-changed).
// aspectRatio (optional): width/height of both the crop tool and the
// dropzone box itself - 3:2 (the family/edit-form standard) unless overridden,
// e.g. 1 for a square individual profile photo.
export default function PhotoDropzone({ label, existingUrl, onChange, onRemove, changed, aspectRatio = 3 / 2 }) {
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(existingUrl || null);
  const [cropModalUrl, setCropModalUrl] = useState(null);
  const [hasEditableSource, setHasEditableSource] = useState(false);

  const objectUrlRef = useRef(null); // blob URL of the cropped output (previewUrl)
  // Raw (uncropped) image behind the currently-applied crop, kept around only
  // so "Adjust crop" can re-open the crop UI without re-compressing an
  // already-cropped image. Only ever updated when a crop is confirmed.
  const sourceUrlRef = useRef(null);
  const sourceMetaRef = useRef(null); // { fileName, mimeType } for sourceUrlRef
  // A freshly picked file waiting on crop confirmation - kept separate from
  // sourceUrlRef so cancelling never disturbs the already-applied photo.
  const pendingPickRef = useRef(null); // { url, fileName, mimeType } | null
  const inputRef = useRef(null);

  useEffect(() => {
    if (!objectUrlRef.current) {
      setPreviewUrl(existingUrl || null);
    }
  }, [existingUrl]);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    if (pendingPickRef.current) URL.revokeObjectURL(pendingPickRef.current.url);
  }, []);

  const handleFile = useCallback((file) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      alert('Only .jpg and .png photos are allowed.');
      return;
    }
    if (pendingPickRef.current) URL.revokeObjectURL(pendingPickRef.current.url);
    const url = URL.createObjectURL(file);
    pendingPickRef.current = { url, fileName: file.name, mimeType: file.type };
    setCropModalUrl(url);
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  };

  const handleEditCrop = (e) => {
    e.stopPropagation();
    if (!sourceUrlRef.current) return;
    setCropModalUrl(sourceUrlRef.current);
  };

  const handleCropCancel = () => {
    // Only a fresh pick needs cleanup - re-opening the crop on the already
    // confirmed source (via "Adjust crop") leaves nothing pending to discard.
    if (pendingPickRef.current) {
      URL.revokeObjectURL(pendingPickRef.current.url);
      pendingPickRef.current = null;
      if (inputRef.current) inputRef.current.value = '';
    }
    setCropModalUrl(null);
  };

  const handleCropConfirm = async (croppedAreaPixels) => {
    const meta = pendingPickRef.current || sourceMetaRef.current;
    const croppedFile = await cropImageToFile(cropModalUrl, croppedAreaPixels, meta.fileName, meta.mimeType);

    if (pendingPickRef.current) {
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
      sourceUrlRef.current = pendingPickRef.current.url;
      sourceMetaRef.current = { fileName: pendingPickRef.current.fileName, mimeType: pendingPickRef.current.mimeType };
      pendingPickRef.current = null;
    }

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const previewObjectUrl = URL.createObjectURL(croppedFile);
    objectUrlRef.current = previewObjectUrl;
    setPreviewUrl(previewObjectUrl);
    setHasEditableSource(true);
    setCropModalUrl(null);
    onChange(croppedFile);
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if (sourceUrlRef.current) {
      URL.revokeObjectURL(sourceUrlRef.current);
      sourceUrlRef.current = null;
      sourceMetaRef.current = null;
    }
    setHasEditableSource(false);
    setPreviewUrl(null);
    if (inputRef.current) inputRef.current.value = '';
    onRemove();
  };

  return (
    <div className="photo-dropzone-wrapper">
      {label && <label className={`photo-dropzone-label${changed ? ' changed' : ''}`}>{label}</label>}
      <div
        className={`photo-dropzone${isDragging ? ' dragging' : ''}${previewUrl ? ' has-photo' : ''}${changed ? ' changed' : ''}`}
        style={{ width: `${120 * aspectRatio}px`, height: '120px' }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        {previewUrl ? (
          <>
            <img src={previewUrl} alt="Preview" className="photo-preview" />
            {hasEditableSource && (
              <button type="button" className="photo-edit-crop-btn" onClick={handleEditCrop} title="Adjust crop">
                Adjust crop
              </button>
            )}
            <button type="button" className="photo-remove-btn" onClick={handleRemove} title="Remove photo">
              &times;
            </button>
          </>
        ) : (
          <div className="photo-dropzone-placeholder">
            <span>Drag & drop a photo here</span>
            <span className="photo-dropzone-hint">or click to browse (.jpg, .png)</span>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          className="photo-dropzone-input"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      {cropModalUrl && (
        <PhotoCropModal
          imageUrl={cropModalUrl}
          aspectRatio={aspectRatio}
          onCancel={handleCropCancel}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  );
}
