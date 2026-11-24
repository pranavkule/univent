export default function AdminUsers() {
  return (
    <>
      <p className="muted org-sub">
        The user directory and account-status controls are not available through
        the backend API.
      </p>
      <div className="alert alert-empty" role="status">
        No account records are loaded or simulated on this page. User management
        requires a dedicated Cognito-backed API.
      </div>
    </>
  )
}
