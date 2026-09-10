import { useCallback, useEffect, useRef, useState } from 'react';
import './PhotoDropzone.css';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png'];

// Drag-and-drop (or click-to-browse) photo uploader with preview.
// existingUrl: server-relative path of a previously saved photo, if any
// onChange(file): called with a new File when the user picks/drops one
// onRemove(): called when the user clears the current photo
export default function PhotoDropzone({ label, existingUrl, onChange, onRemove }) {
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(existingUrl || null);
  const objectUrlRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!objectUrlRef.current) {
      setPreviewUrl(existingUrl || null);
    }
  }, [existingUrl]);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  const handleFile = useCallback((file) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      alert('Only .jpg and .png photos are allowed.');
      return;
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPreviewUrl(url);
    onChange(file);
  }, [onChange]);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPreviewUrl(null);
    if (inputRef.current) inputRef.current.value = '';
    onRemove();
  };

  return (
    <div className="photo-dropzone-wrapper">
      {label && <label className="photo-dropzone-label">{label}</label>}
      <div
        className={`photo-dropzone${isDragging ? ' dragging' : ''}${previewUrl ? ' has-photo' : ''}`}
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
    </div>
  );
}
