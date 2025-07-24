#!/bin/bash
# =============================================================================
# Docker Development Helper Script
# Provides convenient commands for Docker development workflow
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Help function
show_help() {
    echo "Docker Development Helper Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  up                 Start all development services"
    echo "  down               Stop all services"
    echo "  restart            Restart all services"
    echo "  build              Build all services"
    echo "  rebuild            Force rebuild all services"
    echo "  logs [service]     Show logs for all services or specific service"
    echo "  shell [service]    Open shell in service container"
    echo "  clean              Clean up containers, volumes, and images"
    echo "  reset              Complete reset (clean + rebuild)"
    echo "  status             Show status of all services"
    echo "  test               Run tests in containers"
    echo "  migrate            Run Django migrations"
    echo "  collectstatic      Collect Django static files"
    echo "  createsuperuser    Create Django superuser"
    echo "  dev-tools          Start development tools (pgAdmin, Redis Commander)"
    echo "  prod               Start production environment"
    echo "  help               Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 up              # Start development environment"
    echo "  $0 logs backend    # Show backend logs"
    echo "  $0 shell frontend  # Open shell in frontend container"
    echo "  $0 clean           # Clean up Docker resources"
}

# Start development services
start_dev() {
    print_status "Starting development environment..."
    docker-compose up -d
    print_success "Development environment started!"
    print_status "Frontend: http://localhost:3000"
    print_status "Backend: http://localhost:8000"
    print_status "pgAdmin: http://localhost:5050 (if dev-tools profile is active)"
}

# Stop services
stop_services() {
    print_status "Stopping all services..."
    docker-compose down
    print_success "All services stopped!"
}

# Restart services
restart_services() {
    print_status "Restarting all services..."
    docker-compose restart
    print_success "All services restarted!"
}

# Build services
build_services() {
    print_status "Building all services..."
    docker-compose build
    print_success "All services built!"
}

# Force rebuild services
rebuild_services() {
    print_status "Force rebuilding all services..."
    docker-compose build --no-cache
    print_success "All services rebuilt!"
}

# Show logs
show_logs() {
    if [ -z "$1" ]; then
        print_status "Showing logs for all services..."
        docker-compose logs -f
    else
        print_status "Showing logs for $1..."
        docker-compose logs -f "$1"
    fi
}

# Open shell in container
open_shell() {
    if [ -z "$1" ]; then
        print_error "Please specify a service name"
        exit 1
    fi
    
    print_status "Opening shell in $1 container..."
    docker-compose exec "$1" /bin/sh
}

# Clean up Docker resources
clean_docker() {
    print_warning "This will remove all stopped containers, unused networks, and dangling images."
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Cleaning up Docker resources..."
        docker-compose down -v
        docker system prune -f
        print_success "Docker cleanup completed!"
    else
        print_status "Cleanup cancelled."
    fi
}

# Complete reset
reset_environment() {
    print_warning "This will completely reset the development environment."
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        clean_docker
        rebuild_services
        start_dev
        print_success "Environment reset completed!"
    else
        print_status "Reset cancelled."
    fi
}

# Show status
show_status() {
    print_status "Service status:"
    docker-compose ps
}

# Run tests
run_tests() {
    print_status "Running tests..."
    docker-compose exec frontend pnpm test
    docker-compose exec backend python manage.py test
    print_success "Tests completed!"
}

# Run Django migrations
run_migrations() {
    print_status "Running Django migrations..."
    docker-compose exec backend python manage.py makemigrations
    docker-compose exec backend python manage.py migrate
    print_success "Migrations completed!"
}

# Collect static files
collect_static() {
    print_status "Collecting Django static files..."
    docker-compose exec backend python manage.py collectstatic --noinput
    print_success "Static files collected!"
}

# Create superuser
create_superuser() {
    print_status "Creating Django superuser..."
    docker-compose exec backend python manage.py createsuperuser
    print_success "Superuser created!"
}

# Start development tools
start_dev_tools() {
    print_status "Starting development tools..."
    docker-compose --profile dev-tools up -d pgadmin redis-commander
    print_success "Development tools started!"
    print_status "pgAdmin: http://localhost:5050"
    print_status "Redis Commander: http://localhost:8081"
}

# Start production environment
start_production() {
    print_status "Starting production environment..."
    docker-compose -f docker-compose.prod.yml up -d
    print_success "Production environment started!"
}

# Main script logic
case "$1" in
    up)
        start_dev
        ;;
    down)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    build)
        build_services
        ;;
    rebuild)
        rebuild_services
        ;;
    logs)
        show_logs "$2"
        ;;
    shell)
        open_shell "$2"
        ;;
    clean)
        clean_docker
        ;;
    reset)
        reset_environment
        ;;
    status)
        show_status
        ;;
    test)
        run_tests
        ;;
    migrate)
        run_migrations
        ;;
    collectstatic)
        collect_static
        ;;
    createsuperuser)
        create_superuser
        ;;
    dev-tools)
        start_dev_tools
        ;;
    prod)
        start_production
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac