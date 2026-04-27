from .base import *
 
DEBUG = True
ALLOWED_HOSTS = ['localhost', '127.0.0.1']
 
# SQLite — no database server needed for development
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}
 
# Print emails to terminal instead of sending them
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
 
# Show SQL queries in terminal (useful for debugging)
LOGGING = {
    'version': 1,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'loggers': {'django.db.backends': {'handlers': ['console'], 'level': 'DEBUG'}},
}