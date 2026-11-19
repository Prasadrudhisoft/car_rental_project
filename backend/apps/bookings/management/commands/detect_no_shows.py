from django.core.management.base import BaseCommand
from apps.bookings.lifecycle import sweep_no_shows


class Command(BaseCommand):
    help = 'Mark confirmed bookings whose pickup date has passed as NO_SHOW.'

    def handle(self, *args, **opts):
        self.stdout.write(f'{sweep_no_shows()} booking(s) marked no-show.')