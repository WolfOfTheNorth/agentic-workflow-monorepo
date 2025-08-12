# Backend CLAUDE.md

This file provides guidance for working with the Django REST API backend.

## Backend Architecture

This is a Django REST API backend providing authentication and data services for the frontend application.

### Tech Stack

- **Django**: Python web framework
- **Django REST Framework**: API development framework
- **SQLite**: Development database
- **PostgreSQL**: Production database (configured for deployment)
- **pnpm**: Package manager for any Node.js tooling

### Directory Structure

```
apps/backend/
├── backend/                 # Django project configuration
│   ├── __init__.py
│   ├── settings.py         # Django settings
│   ├── urls.py            # URL routing
│   ├── wsgi.py            # WSGI application
│   └── asgi.py            # ASGI application (for async)
├── staticfiles/           # Static files (admin, etc.)
├── db.sqlite3            # SQLite database (development)
├── manage.py             # Django management commands
├── requirements.txt      # Python dependencies
├── package.json          # Node.js dependencies (if any)
└── tsconfig.json         # TypeScript config (for tooling)
```

## Development Commands

### Local Development

```bash
# Install Python dependencies
pip install -r requirements.txt

# Install Node.js dependencies (if any)
pnpm install

# Start Django development server
pnpm dev:backend

# Or directly with Django
python manage.py runserver
```

### Database Management

```bash
# Create migrations
pnpm makemigrations
# Or directly: python manage.py makemigrations

# Apply migrations
pnpm migrate
# Or directly: python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Access Django admin
# Visit http://localhost:8000/admin
```

### Code Quality

```bash
# Install development tools
pip install black flake8 isort mypy

# Format code with Black
black .

# Lint with flake8
flake8 .

# Sort imports
isort .

# Type checking (if configured)
mypy .
```

### Testing

```bash
# Run Django tests
pnpm test:backend

# Or directly with Django
python manage.py test

# Run with coverage
coverage run --source='.' manage.py test
coverage report
```

## Django Project Structure

### Settings Configuration

Key settings in `backend/settings.py`:

```python
# Database configuration
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# REST Framework configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}

# CORS settings for frontend integration
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",  # React dev server
]
```

### URL Configuration

Main URL patterns in `backend/urls.py`:

```python
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('authentication.urls')),
    path('api/v1/', include('api.urls')),
]
```

## API Development Guidelines

### Creating Django Apps

```bash
# Create a new Django app
python manage.py startapp app_name

# Add to INSTALLED_APPS in settings.py
INSTALLED_APPS = [
    # ... other apps
    'app_name',
]
```

### Model Development

```python
from django.db import models
from django.contrib.auth.models import User

class ExampleModel(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title
```

### Serializer Development

```python
from rest_framework import serializers
from .models import ExampleModel

class ExampleModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExampleModel
        fields = ['id', 'title', 'content', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
```

### ViewSet Development

```python
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import ExampleModel
from .serializers import ExampleModelSerializer

class ExampleModelViewSet(viewsets.ModelViewSet):
    serializer_class = ExampleModelSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ExampleModel.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def custom_action(self, request, pk=None):
        instance = self.get_object()
        # Custom logic here
        return Response({'status': 'action completed'})
```

### URL Configuration for Apps

```python
# app_name/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ExampleModelViewSet

router = DefaultRouter()
router.register(r'examples', ExampleModelViewSet, basename='example')

urlpatterns = [
    path('', include(router.urls)),
]
```

## Authentication Integration

The backend is designed to work with the authentication system in the `@agentic-workflow/api` package.

### Key Integration Points

1. **User Authentication**: Django's built-in User model
2. **Token Authentication**: REST Framework token authentication
3. **Session Management**: Django sessions for web authentication
4. **CORS**: Configured for frontend integration

### Authentication Views

```python
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token
from rest_framework.response import Response

class CustomAuthToken(ObtainAuthToken):
    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data,
                                          context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        token, created = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user_id': user.pk,
            'email': user.email
        })
```

## Database Management

### Migrations

```bash
# Create migrations after model changes
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Show migration status
python manage.py showmigrations

# Rollback migrations
python manage.py migrate app_name 0001
```

### Database Operations

```bash
# Access Django shell
python manage.py shell

# Load data from fixtures
python manage.py loaddata fixture_name

# Dump data to fixtures
python manage.py dumpdata app_name > fixture_name.json
```

## Testing Strategy

### Unit Tests

```python
from django.test import TestCase
from django.contrib.auth.models import User
from .models import ExampleModel

class ExampleModelTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )

    def test_model_creation(self):
        example = ExampleModel.objects.create(
            user=self.user,
            title='Test Title',
            content='Test content'
        )
        self.assertEqual(example.title, 'Test Title')
        self.assertEqual(example.user, self.user)
```

### API Tests

```python
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth.models import User

class ExampleAPITestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)

    def test_create_example(self):
        data = {
            'title': 'Test Title',
            'content': 'Test content'
        }
        response = self.client.post('/api/v1/examples/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
```

## Production Deployment

### Environment Configuration

Create environment-specific settings:

```python
# settings/production.py
from .base import *

DEBUG = False
ALLOWED_HOSTS = ['your-domain.com']

# Production database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME'),
        'USER': os.environ.get('DB_USER'),
        'PASSWORD': os.environ.get('DB_PASSWORD'),
        'HOST': os.environ.get('DB_HOST'),
        'PORT': os.environ.get('DB_PORT'),
    }
}

# Security settings
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
```

### Static Files

```bash
# Collect static files for production
python manage.py collectstatic
```

## Integration with Frontend

### API Endpoints

The backend provides RESTful APIs that the frontend consumes:

- **Authentication**: `/api/auth/login/`, `/api/auth/register/`
- **User Management**: `/api/auth/user/`, `/api/auth/profile/`
- **Application APIs**: `/api/v1/` endpoints

### CORS Configuration

```python
# settings.py
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",  # React dev server
    "https://your-frontend-domain.com",  # Production frontend
]

CORS_ALLOW_CREDENTIALS = True
```

## Common Tasks

### Adding a New API Endpoint

1. Create or modify models in `models.py`
2. Create migrations: `python manage.py makemigrations`
3. Apply migrations: `python manage.py migrate`
4. Create serializers in `serializers.py`
5. Create views/viewsets in `views.py`
6. Add URL patterns in `urls.py`
7. Write tests
8. Update API documentation

### Database Schema Changes

1. Modify model in `models.py`
2. Create migration: `python manage.py makemigrations`
3. Review migration file
4. Apply migration: `python manage.py migrate`
5. Update serializers and views if needed
6. Update tests

### Adding Authentication

1. Configure authentication in settings
2. Add authentication views
3. Update URL patterns
4. Configure permissions on views
5. Test authentication flow

## Troubleshooting

### Common Issues

1. **Migration conflicts**: Resolve with `python manage.py migrate --fake`
2. **Static files not loading**: Run `python manage.py collectstatic`
3. **CORS errors**: Check CORS configuration in settings
4. **Database connection errors**: Verify database configuration

### Debugging

1. Use Django Debug Toolbar for development
2. Check Django logs for errors
3. Use `python manage.py shell` for debugging
4. Enable DEBUG mode for detailed error pages

### Performance

1. Use database indexing for frequently queried fields
2. Implement pagination for large datasets
3. Use select_related and prefetch_related for query optimization
4. Consider caching for frequently accessed data
