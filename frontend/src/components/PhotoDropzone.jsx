import { useCallback, useEffect, useRef, useState } from 'react';
import PhotoCropModal from './PhotoCropModal';
import { cropImageToFile } from '../utils/cropImage';
import './PhotoDropzone.css';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png'];
const BOX_HEIGHT = 120;
const DEFAULT_RATIO = 3 / 2;

// width/height of an image, once it has loaded.
function loadImageRatio(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth / img.naturalHeight || DEFAULT_RATIO);
    img.onerror = () => resolve(DEFAULT_RATIO);
    img.src = url;
  });
}

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
// e.g. 1 for a square individual profile photo. 'auto' (the site logo) sizes
// the box to the current image's own shape, and starts the crop tool at the
// picked image's own shape so nothing is trimmed unless the user zooms in.
export default function PhotoDropzone({ label, existingUrl, onChange, onRemove, changed, aspectRatio = DEFAULT_RATIO }) {
  const autoRatio = aspectRatio === 'auto';
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(existingUrl || null);
  const [cropModalUrl, setCropModalUrl] = useState(null);
  const [hasEditableSource, setHasEditableSource] = useState(false);
  const [previewRatio, setPreviewRatio] = useState(null); // auto mode: shown image's shape
  const [cropRatio, setCropRatio] = useState(DEFAULT_RATIO); // auto mode: crop tool's shape

  const objectUrlRef = useRef(null); // blob URL of the cropped output (previewUrl)
  // Raw (uncropped) image behind the currently-applied crop, kept around only
  // so "Adjust crop" can re-open the crop UI without re-compressing an
  // already-cropped image. Only ever updated when a crop is confirmed.
  const sourceUrlRef = useRef(null);
  const sourceMetaRef = useRef(null); // { fileName, mimeType, ratio } for sourceUrlRef
  // A freshly picked file waiting on crop confirmation - kept separate from
  // sourceUrlRef so cancelling never disturbs the already-applied photo.
  const pendingPickRef = useRef(null); // { url, fileName, mimeType, ratio } | null
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

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      alert('Only .jpg and .png photos are allowed.');
      return;
    }
    if (pendingPickRef.current) URL.revokeObjectURL(pendingPickRef.current.url);
    const url = URL.createObjectURL(file);
    const ratio = autoRatio ? await loadImageRatio(url) : aspectRatio;
    pendingPickRef.current = { url, fileName: file.name, mimeType: file.type, ratio };
    setCropRatio(ratio);
    setCropModalUrl(url);
  }, [autoRatio, aspectRatio]);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  };

  const handleEditCrop = (e) => {
    e.stopPropagation();
    if (!sourceUrlRef.current) return;
    setCropRatio(sourceMetaRef.current.ratio);
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
      const { fileName, mimeType, ratio } = pendingPickRef.current;
      sourceMetaRef.current = { fileName, mimeType, ratio };
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

  const boxRatio = autoRatio ? (previewUrl && previewRatio) || DEFAULT_RATIO : aspectRatio;
  // Auto mode can get very wide (e.g. a banner logo) - cap it at the
  // available width and let the height shrink to keep the shape.
  const boxStyle = autoRatio
    ? { width: `min(${BOX_HEIGHT * boxRatio}px, 100%)`, aspectRatio: String(boxRatio) }
    : { width: `${BOX_HEIGHT * aspectRatio}px`, height: `${BOX_HEIGHT}px` };

  return (
    <div className="photo-dropzone-wrapper">
      {label && <label className={`photo-dropzone-label${changed ? ' changed' : ''}`}>{label}</label>}
      <div
        className={`photo-dropzone${isDragging ? ' dragging' : ''}${previewUrl ? ' has-photo' : ''}${changed ? ' changed' : ''}${autoRatio ? ' auto-ratio' : ''}`}
        style={boxStyle}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        {previewUrl ? (
          <>
            <img
              src={previewUrl}
              alt="Preview"
              className="photo-preview"
              onLoad={autoRatio ? (e) => setPreviewRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight) : undefined}
            />
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
          aspectRatio={autoRatio ? cropRatio : aspectRatio}
          onCancel={handleCropCancel}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  );
}
