import { useOutletContext } from 'react-router-dom';
import ChangePasswordForm from '../components/ChangePasswordForm';
import NotificationSettingsForm from '../components/NotificationSettingsForm';

export default function AccountRoute() {
  const { isAdmin, user } = useOutletContext();
  return (
    <>
      {isAdmin && <NotificationSettingsForm user={user} />}
      <ChangePasswordForm />
    </>
  );
}
