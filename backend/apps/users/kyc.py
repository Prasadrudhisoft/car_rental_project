from apps.users.models import CustomerProfile


def evaluate_kyc(user):
    """
    Promote pending -> verified once ALL requirements are met:
      phone verified + email verified + (Aadhaar or PAN) + driving licence.
    Safe to call any time (idempotent). 'rejected' is an admin decision and is never overridden.
    Returns the current kyc_status ('' if the user has no customer profile).
    """
    profile = getattr(user, 'customer_profile', None)
    if profile is None:
        return ''
    if profile.kyc_status != 'pending':
        return profile.kyc_status

    has_identity = bool((profile.aadhaar_number or '').strip() or (profile.pan_number or '').strip())
    has_licence  = bool((profile.driving_licence or '').strip())

    if user.is_phone_verified and user.is_email_verified and has_identity and has_licence:
        # conditional UPDATE: race-safe, no lost updates
        CustomerProfile.objects.filter(pk=profile.pk, kyc_status='pending').update(kyc_status='verified')
        profile.kyc_status = 'verified'
    return profile.kyc_status