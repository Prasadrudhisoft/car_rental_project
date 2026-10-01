from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from apps.users.kyc import evaluate_kyc


class Command(BaseCommand):
    help = 'Promote eligible pending customers to KYC verified.'

    def handle(self, *args, **opts):
        n = 0
        qs = get_user_model().objects.filter(
            role='customer', is_phone_verified=True, is_email_verified=True,
            customer_profile__kyc_status='pending',
        ).select_related('customer_profile')
        for u in qs.iterator():
            if evaluate_kyc(u) == 'verified':
                n += 1
        self.stdout.write(f'{n} customer(s) promoted.')