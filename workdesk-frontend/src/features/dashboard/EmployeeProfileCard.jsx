import { useEffect, useRef, useState } from 'react';
import { reportService, profilePhotoService } from '@/services/index.js';
import { personColor } from '@/utils/colors.js';
import { encodeImage } from '@/utils/image.js';
import { fmtDate } from '@/utils/format.js';

export default function EmployeeProfileCard({ user, employeeId, today, todayError, refreshKey }) {
  const [photo, setPhoto] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [photoError, setPhotoError] = useState('');
  const [performanceError, setPerformanceError] = useState('');
  const [busy, setBusy] = useState(false);
  const [photoActionsOpen, setPhotoActionsOpen] = useState(false);
  const inputRef = useRef(null);
  const photoRef = useRef(null);

  const replacePhoto = (url) => {
    if (photoRef.current) URL.revokeObjectURL(photoRef.current);
    photoRef.current = url;
    setPhoto(url);
  };

  useEffect(() => {
    let active = true;
    replacePhoto(null);
    profilePhotoService.get(employeeId)
      .then((url) => {
        if (active) replacePhoto(url);
        else if (url) URL.revokeObjectURL(url);
      })
      .catch((error) => active && setPhotoError(error.message));
    return () => {
      active = false;
      if (photoRef.current) URL.revokeObjectURL(photoRef.current);
      photoRef.current = null;
    };
  }, [employeeId]);

  useEffect(() => {
    let active = true;
    reportService.performance({ employeeId })
      .then((result) => active && setPerformance(result))
      .catch((error) => active && setPerformanceError(error.message));
    return () => { active = false; };
  }, [employeeId, refreshKey]);

  const upload = async (file) => {
    if (!file) return;
    setPhotoError('');
    setPhotoActionsOpen(false);
    setBusy(true);
    try {
      const base64 = await encodeImage(file);
      await profilePhotoService.save(base64, employeeId);
      const url = await profilePhotoService.get(employeeId);
      replacePhoto(url);
    } catch (error) {
      setPhotoError(error.message || 'Could not upload this image.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removePhoto = async () => {
    setPhotoError('');
    setPhotoActionsOpen(false);
    setBusy(true);
    try {
      await profilePhotoService.remove(employeeId);
      replacePhoto(null);
    } catch (error) {
      setPhotoError(error.message || 'Could not remove this image.');
    } finally {
      setBusy(false);
    }
  };

  const openPhotoPicker = () => {
    setPhotoActionsOpen(false);
    inputRef.current?.click();
  };

  const completion = performance?.completionRate ?? 0;

  return (
    <section className="panel employee-profile-card" aria-label="Employee profile and progress">
      <div className="employee-profile-photo-column">
        <button type="button" className="employee-profile-photo" style={{ background: personColor(user.fullName) }}
          disabled={busy} onClick={openPhotoPicker} aria-label={`Choose profile photo for ${user.fullName}`}>
          {photo
            ? <img src={photo} alt={`${user.fullName} profile`} />
            : <span aria-hidden="true">{user.fullName.charAt(0).toUpperCase()}</span>}
        </button>
        <button type="button" className="link-btn" disabled={busy}
          onClick={() => photo ? setPhotoActionsOpen((open) => !open) : openPhotoPicker()}>
          {photo ? 'Change image' : 'Add image'}
        </button>
        {photo && photoActionsOpen && (
          <div className="employee-photo-options" aria-label="Profile image actions">
            <button type="button" className="link-btn" disabled={busy} onClick={openPhotoPicker}>Select new image</button>
            <button type="button" className="link-btn danger" disabled={busy} onClick={removePhoto}>Remove image</button>
          </div>
        )}
        <input ref={inputRef} className="sr-only" type="file" accept="image/*"
          aria-label="Choose profile photo" onChange={(event) => upload(event.target.files?.[0])} />
      </div>

      <div className="employee-profile-main">
        <div className="employee-profile-heading">
          <div>
            <h2>{user.fullName}</h2>
            <p className="muted">{[user.designation, user.department].filter(Boolean).join(' · ') || 'Employee'}</p>
          </div>
          <span className="profile-role">{user.role === 'ADMIN' ? 'Administrator' : 'Employee'}</span>
        </div>
        <dl className="employee-profile-details">
          <div><dt>Email</dt><dd>{user.email}</dd></div>
          <div><dt>Employee code</dt><dd>{user.employeeCode || '—'}</dd></div>
          <div><dt>Phone</dt><dd>{user.phone || '—'}</dd></div>
          {user.createdAt && <div><dt>Joined</dt><dd>{fmtDate(user.createdAt)}</dd></div>}
        </dl>

        <div className="employee-profile-progress">
          <div className="employee-progress-heading">
            <strong>This month</strong>
            <span>{performance ? `${completion.toFixed(completion % 1 ? 1 : 0)}% · ${performance.completed} of ${performance.total} tasks done`
              : performanceError || 'Loading progress…'}</span>
          </div>
          <div className="employee-progress-track" role="progressbar" aria-label="Monthly completion"
            aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(completion)}>
            <span style={{ width: `${completion}%` }} />
          </div>
          <div className="employee-profile-counts">
            <span><b>{today?.todo ?? '—'}</b> To do</span>
            <span><b>{today?.progress ?? '—'}</b> In progress</span>
            <span><b>{today?.done ?? '—'}</b> Done today</span>
            <span><b>{performance?.overdue ?? '—'}</b> Overdue</span>
          </div>
        </div>
        {todayError && <p className="error small" role="alert">{todayError}</p>}
        {photoError && <p className="error small" role="alert">{photoError}</p>}
      </div>
    </section>
  );
}
