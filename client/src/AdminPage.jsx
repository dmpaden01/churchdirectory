import { useState } from 'react';
import FamilySearch from './components/FamilySearch';
import FamilyForm from './components/FamilyForm';
import ImportPdf from './components/ImportPdf';
import UserManagement from './components/UserManagement';
import ChangePasswordForm from './components/ChangePasswordForm';
import { getFamily } from './api/families';
import { logout } from './api/auth';
import './AdminPage.css';

const FAMILY_VIEWS = ['search', 'form', 'import', 'import-form'];

// view: 'search' | 'form' | 'import' | 'import-form' | 'users' | 'account'
export default function AdminPage({ user, onLoggedOut }) {
  const [view, setView] = useState('search');
  const [activeFamily, setActiveFamily] = useState(null);
  const [loadingFamily, setLoadingFamily] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [parsedFamilies, setParsedFamilies] = useState([]);
  const [totalParsedCount, setTotalParsedCount] = useState(null);
  const [activeDraftKey, setActiveDraftKey] = useState(null);

  const openAddNew = () => {
    setActiveFamily(null);
    setView('form');
  };

  const openFamily = async (id) => {
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

  const openImport = () => setView('import');

  const familiesParsed = (families) => {
    setParsedFamilies(families);
    setTotalParsedCount(families.length);
  };

  const reviewDraft = (key) => {
    setActiveDraftKey(key);
    setView('import-form');
  };

  const skipDraft = (key) => {
    setParsedFamilies((prev) => prev.filter((f) => f._key !== key));
  };

  const draftSaved = () => {
    setParsedFamilies((prev) => prev.filter((f) => f._key !== activeDraftKey));
    setActiveDraftKey(null);
    setView('import');
    setRefreshToken((t) => t + 1);
  };

  const draftCanceled = () => {
    setActiveDraftKey(null);
    setView('import');
  };

  const activeDraft = parsedFamilies.find((f) => f._key === activeDraftKey) || null;

  const handleLogout = async () => {
    await logout();
    onLoggedOut();
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>Church Directory Admin</h1>
        <div className="admin-header-right">
          <span className="admin-current-user">Signed in as {user.username}</span>
          <button type="button" onClick={handleLogout}>Sign Out</button>
        </div>
      </header>

      <nav className="admin-nav">
        <button
          type="button"
          className={FAMILY_VIEWS.includes(view) ? 'active' : ''}
          onClick={() => setView('search')}
        >
          Families
        </button>
        <button
          type="button"
          className={view === 'users' ? 'active' : ''}
          onClick={() => setView('users')}
        >
          Users
        </button>
        <button
          type="button"
          className={view === 'account' ? 'active' : ''}
          onClick={() => setView('account')}
        >
          Account
        </button>
      </nav>

      {loadingFamily && <p className="family-search-status">Loading family...</p>}

      {view === 'users' && <UserManagement currentUser={user} />}

      {view === 'account' && <ChangePasswordForm />}

      {view === 'search' && !loadingFamily && (
        <FamilySearch
          onSelectFamily={openFamily}
          onAddNew={openAddNew}
          onImport={openImport}
          refreshToken={refreshToken}
        />
      )}

      {view === 'form' && !loadingFamily && (
        <FamilyForm
          family={activeFamily}
          onSaved={backToSearch}
          onDeleted={backToSearch}
          onCancel={backToSearch}
        />
      )}

      {view === 'import' && (
        <ImportPdf
          parsedFamilies={parsedFamilies}
          totalCount={totalParsedCount}
          onParsed={familiesParsed}
          onReview={reviewDraft}
          onSkip={skipDraft}
          onDone={backToSearch}
        />
      )}

      {view === 'import-form' && (
        <FamilyForm
          draft={activeDraft}
          onSaved={draftSaved}
          onCancel={draftCanceled}
        />
      )}
    </div>
  );
}
