import './sign-out-progress-modal.css'

type SignOutProgressModalProps = {
  merchantName?: string | null
}

export function SignOutProgressModal({
  merchantName
}: SignOutProgressModalProps): React.JSX.Element {
  return (
    <div className="sign-out-progress-modal">
      <div className="sign-out-progress-modal__card">
        <h1 className="sign-out-progress-modal__title">Signing Out</h1>
        <p className="sign-out-progress-modal__body">
          {merchantName
            ? `Finishing sync for ${merchantName}.`
            : 'Finishing sync for this account.'}
        </p>
        <p className="sign-out-progress-modal__note">
          Pending changes are being uploaded before the account closes.
        </p>
      </div>
    </div>
  )
}
