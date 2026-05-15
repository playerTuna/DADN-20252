import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { StatusMessage } from '../components/StatusMessage';
import { getUser, updateUserProfile, type UserProfile } from '../services/api';

function getInitials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || 'User';

  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const nextProfile = await getUser();

        if (cancelled) return;

        setProfile(nextProfile);
        setDisplayName(nextProfile.displayName ?? '');
        setError(null);
      } catch (err) {
        console.log('Profile load failed', err);

        if (!cancelled) {
          setError('Unable to load profile.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const email = profile?.email || 'Unavailable';
  const userId = profile?.id || 'Unavailable';

  const initials = useMemo(
    () => getInitials(displayName, profile?.email),
    [displayName, profile?.email]
  );

  const hasChanged = displayName.trim() !== (profile?.displayName ?? '').trim();

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = displayName.trim();

    if (!trimmed) {
      setError('Display name cannot be empty.');
      setSuccess(null);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const nextProfile = await updateUserProfile({
        displayName: trimmed,
      });

      setProfile(nextProfile);
      setDisplayName(nextProfile.displayName ?? trimmed);
      setSuccess('Profile updated.');
    } catch (err) {
      console.log('Profile save failed', err);
      setError('Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-stack profile-page-web">
      <header className="profile-hero-card">
        <div className="profile-hero-avatar">{initials}</div>

        <div>
          <p className="eyebrow">Account</p>
          <h1>Profile</h1>
          <p>Update your display name and review your account information.</p>
        </div>

        {loading ? <span className="spinner" /> : null}
      </header>

      {error ? <StatusMessage>{error}</StatusMessage> : null}
      {success ? <StatusMessage tone="success">{success}</StatusMessage> : null}

      <section className="profile-layout">
        <form className="profile-card" onSubmit={handleSave}>
          <div className="profile-card-heading">
            <h2>Profile information</h2>
            <p>
              Only your display name can be edited. Email and User ID are managed by the system.
            </p>
          </div>

          <label className="profile-field">
            <span>Display name</span>
            <input
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
                setSuccess(null);
              }}
              placeholder="Display name"
              disabled={loading || saving}
            />
          </label>

          <label className="profile-field">
            <span>Email</span>
            <input value={email} disabled readOnly />
          </label>

          <label className="profile-field">
            <span>User ID</span>
            <input value={userId} disabled readOnly />
          </label>

          <button
            className="profile-save-button"
            type="submit"
            disabled={loading || saving || !hasChanged}
          >
            {saving ? 'Saving...' : hasChanged ? 'Save profile' : 'Saved'}
          </button>
        </form>

        <aside className="profile-preview-card">
          <div className="profile-preview-avatar">{initials}</div>

          <h2>{displayName.trim() || 'Unnamed user'}</h2>
          <p>{email}</p>

          <div className="profile-preview-info">
            <span>User ID</span>
            <strong>{userId}</strong>
          </div>

          <span className="profile-preview-pill">Smart Farm user</span>
        </aside>
      </section>
    </div>
  );
}
