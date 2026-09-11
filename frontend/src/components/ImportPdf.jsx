import { useRef, useState } from 'react';
import { parseDirectoryPdf } from '../api/families';
import './ImportPdf.css';

// Uploads a legacy "Church Directory" PDF, parses it into draft family records
// server-side, and lets the admin work through the batch one family at a time.
export default function ImportPdf({ parsedFamilies, totalCount, onParsed, onReview, onSkip, onAcceptAll, accepting, onDone }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [skippedUpToDateCount, setSkippedUpToDateCount] = useState(0);
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('Please choose a .pdf file.');
      return;
    }
    setLoading(true);
    setError(null);
    setSkippedUpToDateCount(0);
    try {
      const { families, skippedUpToDateCount } = await parseDirectoryPdf(file);
      const withKeys = families.map((f, i) => ({ ...f, _key: `${Date.now()}-${i}` }));
      setSkippedUpToDateCount(skippedUpToDateCount || 0);
      onParsed(withKeys);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const importedCount = totalCount === null ? null : totalCount - parsedFamilies.length;

  const handleAcceptAll = () => {
    const confirmed = window.confirm(
      `Accept all ${parsedFamilies.length} remaining famil${parsedFamilies.length === 1 ? 'y' : 'ies'} without reviewing them individually?\n\n` +
      'This imported data could be incorrect (e.g. mismatched photos or parsing errors). ' +
      'These families will be saved as-is and marked "Needs Review" so an admin can double-check them later.',
    );
    if (confirmed) onAcceptAll();
  };

  return (
    <div className="import-pdf">
      <h2>Import Families from PDF</h2>
      <p className="import-pdf-hint">
        Upload a legacy directory PDF export. Each family found in the file will be parsed into a
        draft you can review, complete, and save individually.
      </p>

      <div
        className={`import-dropzone${dragging ? ' dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]); }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        {loading ? 'Parsing PDF...' : 'Drag & drop a directory PDF here, or click to browse'}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="import-dropzone-input"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      {error && <div className="form-error">{error}</div>}

      {skippedUpToDateCount > 0 && (
        <p className="import-pdf-skipped-note">
          {skippedUpToDateCount} famil{skippedUpToDateCount === 1 ? 'y' : 'ies'} already matched what&rsquo;s
          saved exactly (including photo) and {skippedUpToDateCount === 1 ? 'was' : 'were'} skipped automatically.
        </p>
      )}

      {parsedFamilies.length > 0 && (
        <>
          <div className="import-pdf-progress-row">
            <p className="import-pdf-progress">
              {accepting
                ? `Accepting remaining families... ${parsedFamilies.length} left`
                : <>{importedCount} of {totalCount} handled &mdash; {parsedFamilies.length} remaining</>}
            </p>
            <button type="button" onClick={handleAcceptAll} disabled={accepting}>
              Accept All Changes
            </button>
          </div>
          <ul className="import-results">
            {parsedFamilies.map((f) => {
              const head = f.individuals[0];
              const spouse = f.individuals.find((i) => i.role === 'spouse');
              const childCount = f.individuals.filter((i) => i.role === 'child').length;
              return (
                <li key={f._key}>
                  <div className="import-result-info">
                    <strong>{head.lastName} Family</strong>
                    <span>
                      {head.firstName} {head.lastName}
                      {spouse ? ` & ${spouse.firstName}` : ''}
                      {childCount > 0 ? ` (+${childCount} child${childCount > 1 ? 'ren' : ''})` : ''}
                    </span>
                    <span className="import-result-location">
                      {f.city}{f.city && f.state ? ', ' : ''}{f.state}
                    </span>
                    {f.existingMatch === 'address' && (
                      <span className="import-result-duplicate">Already in your directory — saving will update it</span>
                    )}
                    {f.existingMatch === 'name' && (
                      <span className="import-result-duplicate">Possible match already in your directory</span>
                    )}
                    {f.notes.length > 0 && (
                      <span className="import-result-warning">{f.notes.length} item(s) to double-check</span>
                    )}
                  </div>
                  <div className="import-result-actions">
                    <button type="button" className="primary-btn" onClick={() => onReview(f._key)} disabled={accepting}>
                      Review & Save
                    </button>
                    <button type="button" onClick={() => onSkip(f._key)} disabled={accepting}>
                      Skip
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {totalCount !== null && parsedFamilies.length === 0 && (
        <p className="family-search-status">All families from this file have been handled.</p>
      )}

      <div className="form-actions">
        <button type="button" onClick={onDone}>Back to Search</button>
      </div>
    </div>
  );
}
