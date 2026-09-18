import { useOutletContext } from 'react-router-dom';
import RequireAdmin from './RequireAdmin';
import UserManagement from '../components/UserManagement';

export default function UsersRoute() {
  const { user } = useOutletContext();
  return (
    <RequireAdmin>
      <UserManagement currentUser={user} />
    </RequireAdmin>
  );
}
