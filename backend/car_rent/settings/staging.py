from .prod import *
import os
DEBUG = True                      # required by the dummy lock
SECURE_SSL_REDIRECT = False if os.environ.get('STAGING_HTTP') else True
PAYMENT_DUMMY_ENABLED = config('PAYMENT_DUMMY_ENABLED', default=True, cast=bool)
RAZORPAY_KEY_ID = RAZORPAY_KEY_SECRET = RAZORPAY_WEBHOOK_SECRET = ''