import { useEffect, useRef, useState } from 'react';
import { reportService, profilePhotoService } from '@/services/index.js';
import { personColor } from '@/utils/colors.js';

export default function EmployeeProfileCard({ user, today, refreshKey }) {
  const [photo, setPhoto] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [photoError, setPhotoError] = useState('');
  const [performanceError, setPerformanceError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const photoRef = useRef(null);

  const replacePhoto = (url) => {
    if (photoRef.current) URL.revokeObjectURL(photoRef.current);
    photoRef.current = url;
    setPhoto(url);
  };

  const loadPhoto = async () => {
    const url = await profilePhotoService.get();
    replacePhoto(url);
  };

  useEffect(() => {
    let active = true;
    profilePhotoService.get()
      .then((url) => {
        if (active) setPhoto(url);
        else if (url) URL.revokeObjectURL(url);
      })
      .catch((error) => active && setPhotoError(error.message));
    return () => {
      active = false;
      if (photoRef.current) URL.revokeObjectURL(photoRef.current);
      photoRef.current = null;
    };
  }, []);

  useEffect(() => {
    let active = true;
    reportService.performance()
      .then((result) => active && setPerformance(result))
      .catch((error) => active && setPerformanceError(error.message));
    return () => { active = false; };
  }, [refreshKey]);

  const upload = async (file) => {
    if (!file) return;
    setPhotoError('');
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
      setPhotoError('Choose an image file smaller than 10 MB.');
      return;
    }

    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const base64 = canvas.toDataURL('image/jpeg', 0.82).split(',')[1];
      await profilePhotoService.save(base64);
      await loadPhoto();
    } catch (error) {
      setPhotoError(error.message || 'Could not upload this image.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removePhoto = async () => {
    setPhotoError('');
    setBusy(true);
    try {
      await profilePhotoService.remove();
      replacePhoto(null);
    } catch (error) {
      setPhotoError(error.message);
    } finally {
      setBusy(false);
    }
  };

  const completion = performance?.completionRate ?? 0;

  return (
    <section className="panel employee-profile-card" aria-label="Employee profile and progress">
      <div className="employee-profile-photo-column">
        <div className="employee-profile-photo" style={{ background: personColor(user.fullName) }}>
          {photo
            ? <img src={photo} alt={`${user.fullName} profile`} />
            : <span aria-hidden="true">{user.fullName.charAt(0).toUpperCase()}</span>}
        </div>
        <div className="employee-photo-actions">
          <input ref={inputRef} className="sr-only" type="file" accept="image/*"
            aria-label="Choose profile photo" onChange={(event) => upload(event.target.files?.[0])} />
          <button type="button" className="link-btn" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? 'Saving…' : photo ? 'Change photo' : 'Add photo'}
          </button>
          {photo && <button type="button" className="link-btn danger" disabled={busy} onClick={removePhoto}>Remove</button>}
        </div>
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
        {photoError && <p className="error small" role="alert">{photoError}</p>}
      </div>
    </section>
  );
}
