import { useState } from 'react';
import FamilySearch from './components/FamilySearch';
import FamilyView from './components/FamilyView';
import FamilyForm from './components/FamilyForm';
import ImportPdf from './components/ImportPdf';
import UserManagement from './components/UserManagement';
import ChangePasswordForm from './components/ChangePasswordForm';
import NotificationSettingsForm from './components/NotificationSettingsForm';
import SiteLogo from './components/SiteLogo';
import SettingsPage from './SettingsPage';
import { getFamily, createFamily, updateFamily } from './api/families';
import { logout } from './api/auth';
import { draftToFormState } from './utils/draftFamily';
import './DirectoryPage.css';

const FAMILY_VIEWS = ['search', 'viewFamily', 'form', 'import', 'import-form'];

// view: 'search' | 'viewFamily' | 'form' | 'import' | 'import-form' | 'users' | 'settings' | 'account'
// Shared between admins and regular users: everyone can search and view families;
// only admins get the edit/add/import/user-management actions.
export default function DirectoryPage({ user, onLoggedOut }) {
  const isAdmin = user.role === 'admin';
  const [view, setView] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('view');
    return requested === 'users' && isAdmin ? 'users' : 'search';
  });
  const [activeFamily, setActiveFamily] = useState(null);
  const [loadingFamily, setLoadingFamily] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [parsedFamilies, setParsedFamilies] = useState([]);
  const [totalParsedCount, setTotalParsedCount] = useState(null);
  const [activeDraftKey, setActiveDraftKey] = useState(null);
  const [matchedFamily, setMatchedFamily] = useState(null);
  const [bulkAccepting, setBulkAccepting] = useState(false);

  const openAddNew = () => {
    if (!isAdmin) return;
    setActiveFamily(null);
    setView('form');
  };

  const openFamily = async (id) => {
    setLoadingFamily(true);
    try {
      const family = await getFamily(id);
      setActiveFamily(family);
      setView('viewFamily');
    } catch (err) {
      alert(err.message);
    } finally {
      setLoadingFamily(false);
    }
  };

  const openEdit = () => {
    if (!isAdmin) return;
    setView('form');
  };

  // "Needs Review" button in the search list - jumps straight into the edit
  // form instead of the read-only view, since the whole point is a fast path
  // to fixing/clearing a flagged family.
  const openReview = async (id) => {
    if (!isAdmin) return;
    setLoadingFamily(true);
    try {
      const family = await getFamily(id);
      setActiveFamily(family);
      setView('form');
    } catch (err) {
      alert(err.message);
    } finally {
      setLoadingFamily(false);
    }
  };

  const backToSearch = () => {
    setActiveFamily(null);
    setView('search');
    setRefreshToken((t) => t + 1);
  };

  const cancelForm = () => {
    if (activeFamily) setView('viewFamily');
    else backToSearch();
  };

  const openImport = () => {
    if (!isAdmin) return;
    setView('import');
  };

  const familiesParsed = (families) => {
    setParsedFamilies(families);
    setTotalParsedCount(families.length);
  };

  // If the import matched an existing family by address, fetch its full record
  // first so the form mounts already in "edit" mode - Review & Save then updates
  // that family instead of creating a duplicate.
  const reviewDraft = async (key) => {
    const draft = parsedFamilies.find((f) => f._key === key);
    setActiveDraftKey(key);
    if (draft?.existingFamilyId) {
      setLoadingFamily(true);
      try {
        setMatchedFamily(await getFamily(draft.existingFamilyId));
      } catch {
        setMatchedFamily(null);
      } finally {
        setLoadingFamily(false);
      }
    } else {
      setMatchedFamily(null);
    }
    setView('import-form');
  };

  const skipDraft = (key) => {
    setParsedFamilies((prev) => prev.filter((f) => f._key !== key));
  };

  const draftSaved = () => {
    setParsedFamilies((prev) => prev.filter((f) => f._key !== activeDraftKey));
    setActiveDraftKey(null);
    setMatchedFamily(null);
    setView('import');
    setRefreshToken((t) => t + 1);
  };

  const draftCanceled = () => {
    setActiveDraftKey(null);
    setMatchedFamily(null);
    setView('import');
  };

  // Saves every remaining parsed family as-is, without individual review,
  // each flagged needsReview so it can be found and double-checked later.
  // Matched-by-address drafts update that family (same as manual review);
  // everything else creates a new one. Removes each family from the pending
  // list as it succeeds so the progress count updates live; anything that
  // fails to save stays in the list for a retry.
  const acceptAllDrafts = async () => {
    setBulkAccepting(true);
    const failures = [];
    for (const draft of parsedFamilies) {
      try {
        const formState = draftToFormState(draft, { needsReview: true });
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
    setRefreshToken((t) => t + 1);
    if (failures.length > 0) {
      alert(`${failures.length} famil${failures.length === 1 ? 'y' : 'ies'} could not be saved and remain in the list:\n\n${failures.join('\n')}`);
    }
  };

  const activeDraft = parsedFamilies.find((f) => f._key === activeDraftKey) || null;

  const handleLogout = async () => {
    await logout();
    onLoggedOut();
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1><SiteLogo className="site-logo" />Church Directory</h1>
        <button type="button" className="admin-header-signout" onClick={handleLogout}>
          Sign Out
        </button>
      </header>

      <nav className="admin-nav">
        <div className="admin-nav-tabs">
          <button
            type="button"
            className={FAMILY_VIEWS.includes(view) ? 'active' : ''}
            onClick={() => setView('search')}
          >
            Families
          </button>
          {isAdmin && (
            <button
              type="button"
              className={view === 'users' ? 'active' : ''}
              onClick={() => setView('users')}
            >
              Users
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              className={view === 'settings' ? 'active' : ''}
              onClick={() => setView('settings')}
            >
              Settings
            </button>
          )}
          <button
            type="button"
            className={view === 'account' ? 'active' : ''}
            onClick={() => setView('account')}
          >
            Account
          </button>
        </div>
        <button type="button" className="admin-nav-signout" onClick={handleLogout}>
          Sign Out
        </button>
      </nav>

      {loadingFamily && <p className="family-search-status">Loading family...</p>}

      {view === 'users' && isAdmin && <UserManagement currentUser={user} />}

      {view === 'settings' && isAdmin && <SettingsPage />}

      {view === 'account' && (
        <>
          {isAdmin && <NotificationSettingsForm user={user} />}
          <ChangePasswordForm />
        </>
      )}

      {view === 'search' && !loadingFamily && (
        <FamilySearch
          onSelectFamily={openFamily}
          onAddNew={openAddNew}
          onImport={openImport}
          onReviewFamily={openReview}
          refreshToken={refreshToken}
          isAdmin={isAdmin}
        />
      )}

      {view === 'viewFamily' && !loadingFamily && activeFamily && (
        <FamilyView
          family={activeFamily}
          isAdmin={isAdmin}
          onEdit={openEdit}
          onBack={backToSearch}
        />
      )}

      {view === 'form' && !loadingFamily && isAdmin && (
        <FamilyForm
          family={activeFamily}
          onSaved={backToSearch}
          onDeleted={backToSearch}
          onCancel={cancelForm}
        />
      )}

      {view === 'import' && isAdmin && (
        <ImportPdf
          parsedFamilies={parsedFamilies}
          totalCount={totalParsedCount}
          onParsed={familiesParsed}
          onReview={reviewDraft}
          onSkip={skipDraft}
          onAcceptAll={acceptAllDrafts}
          accepting={bulkAccepting}
          onDone={backToSearch}
        />
      )}

      {view === 'import-form' && !loadingFamily && isAdmin && (
        <FamilyForm
          family={matchedFamily}
          draft={activeDraft}
          onSaved={draftSaved}
          onDeleted={draftSaved}
          onCancel={draftCanceled}
        />
      )}
    </div>
  );
}
