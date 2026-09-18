import { useNavigate, useOutletContext } from 'react-router-dom';
import ImportPdf from '../components/ImportPdf';
import { getFamily, createFamily, updateFamily } from '../api/families';
import { draftToFormState, computeChangedFields } from '../utils/draftFamily';

export default function ImportRoute() {
  const navigate = useNavigate();
  const {
    parsedFamilies, setParsedFamilies,
    totalParsedCount, setTotalParsedCount,
    bulkAccepting, setBulkAccepting,
    bumpRefresh,
  } = useOutletContext();

  const familiesParsed = (families) => {
    setParsedFamilies(families);
    setTotalParsedCount(families.length);
  };

  const skipDraft = (key) => {
    setParsedFamilies((prev) => prev.filter((f) => f._key !== key));
  };

  // Saves every remaining parsed family as-is, without individual review,
  // each flagged needsReview so it can be found and double-checked later.
  // Matched-by-address drafts update that family (same as manual review);
  // everything else creates a new one. The parser's notes and (for matched
  // families) the field-level diff against what was already saved are
  // persisted too, so a later reviewer opening this family sees the same
  // "please double-check" guidance and highlighted fields an interactive
  // review would have shown - normally saving a family clears both, but this
  // is the one path that deliberately skips that human review step. Removes
  // each family from the pending list as it succeeds so the progress count
  // updates live; anything that fails to save stays in the list for a retry.
  const acceptAllDrafts = async () => {
    setBulkAccepting(true);
    const failures = [];
    for (const draft of parsedFamilies) {
      try {
        let reviewChangedFields;
        if (draft.existingFamilyId) {
          const existingFamily = await getFamily(draft.existingFamilyId);
          reviewChangedFields = computeChangedFields(existingFamily, draft);
        }
        // Position-based photo matching from the PDF is inherently uncertain,
        // so flag the photo for a visual check whenever the draft brought one
        // - regardless of match status, since there's no "before" to diff a
        // brand-new family's photo against.
        if (draft.photoDataUrl) {
          reviewChangedFields = { ...(reviewChangedFields || {}), photo: true };
        }
        const formState = {
          ...draftToFormState(draft, { needsReview: true }),
          reviewNotes: draft.notes,
          reviewChangedFields,
        };
        if (draft.existingFamilyId) {
          await updateFamily(draft.existingFamilyId, formState);
        } else {
          await createFamily(formState);
        }
        setParsedFamilies((prev) => prev.filter((f) => f._key !== draft._key));
      } catch (err) {
        failures.push(`${draft.individuals[0]?.lastName || 'Unknown'}: ${err.message}`);
      }
    }
    setBulkAccepting(false);
    bumpRefresh();
    if (failures.length > 0) {
      alert(`${failures.length} famil${failures.length === 1 ? 'y' : 'ies'} could not be saved and remain in the list:\n\n${failures.join('\n')}`);
    }
  };

  return (
    <ImportPdf
      parsedFamilies={parsedFamilies}
      totalCount={totalParsedCount}
      onParsed={familiesParsed}
      onReview={(key) => navigate(`/import/${key}`, { state: { canGoBack: true } })}
      onSkip={skipDraft}
      onAcceptAll={acceptAllDrafts}
      accepting={bulkAccepting}
      onDone={() => { bumpRefresh(); navigate('/'); }}
    />
  );
}
