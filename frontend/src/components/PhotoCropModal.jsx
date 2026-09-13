import { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import './PhotoCropModal.css';

// Full-screen crop dialog shown after a photo is picked. Zoom starts at 1,
// which react-easy-crop scales/centers to fill the crop box by default -
// i.e. the "best fit, centered" starting point the user then adjusts.
// aspectRatio: width/height of the crop box (e.g. 3/2 for family photos, 1
// for a square individual profile photo) - see PhotoDropzone's own prop.
export default function PhotoCropModal({ imageUrl, aspectRatio, onCancel, onConfirm }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const handleCropComplete = useCallback((_area, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  return (
    <div className="photo-crop-overlay" role="dialog" aria-modal="true" aria-label="Crop photo">
      <div className="photo-crop-dialog">
        <div className="photo-crop-stage">
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio}
            restrictPosition
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
          />
        </div>

        <div className="photo-crop-controls">
          <label className="photo-crop-zoom-control">
            <span>Zoom</span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </label>

          <div className="photo-crop-actions">
            <button type="button" onClick={onCancel}>Cancel</button>
            <button
              type="button"
              className="primary-btn"
              disabled={!croppedAreaPixels}
              onClick={() => onConfirm(croppedAreaPixels)}
            >
              Apply Crop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
