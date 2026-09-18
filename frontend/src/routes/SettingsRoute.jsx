import RequireAdmin from './RequireAdmin';
import SettingsPage from '../SettingsPage';

export default function SettingsRoute() {
  return (
    <RequireAdmin>
      <SettingsPage />
    </RequireAdmin>
  );
}
