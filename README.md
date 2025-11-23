# Meal Assistant

Personal meal tracking system with 7-pattern flexible eating framework, featuring TypeScript API, Python ML analytics, and mobile-first progressive web application.

## Tech Stack

- **Frontend**: TypeScript, Progressive Web App
- **Backend API**: Node.js, TypeScript
- **ML Analytics**: Python 3.x
- **Database**: PostgreSQL (with migrations)
- **State Management**: Redux/Context (store directory)
- **Testing**: Jest (unit, integration, E2E, performance)
- **Deployment**: Docker, Kubernetes
- **CI/CD**: GitHub Actions

## Technical Overview

This project demonstrates a full-stack meal tracking application with machine learning integration for pattern analysis. The implementation includes a 7-pattern flexible eating system, combining TypeScript API services with Python ML analytics for personalized meal insights.

**Key Features:**
- 7-pattern flexible eating system framework
- TypeScript API with comprehensive testing (unit, integration, E2E)
- Python ML components for analytics and predictions
- Mobile-first PWA design
- Docker containerization with multi-stage builds
- Kubernetes deployment configuration
- Database migrations and management
- Performance monitoring and analytics

## Architecture

**Multi-Language Stack:**
- TypeScript for API and frontend services
- Python for ML analytics and data processing
- PostgreSQL for data persistence
- Docker for containerization
- Kubernetes for orchestration

**Components:**
- `src/api/` - REST API endpoints
- `src/ml/` - Machine learning models and analytics
- `src/mobile/` - Mobile-first PWA components
- `src/database/` - Schema and migrations
- `src/analytics/` - Data analysis services

## Exploring the Code

<details>
<summary>Click to expand</summary>

**Project Structure:**
```
meal_assistant/
├── src/
│   ├── api/            # REST API services
│   ├── ml/             # Python ML components
│   ├── mobile/         # Mobile PWA
│   ├── core/           # Core business logic
│   ├── database/       # Database layer
│   ├── analytics/      # Analytics services
│   ├── models/         # Data models
│   └── types/          # TypeScript definitions
├── tests/
│   ├── unit/           # Unit tests
│   ├── integration/    # Integration tests
│   ├── e2e/            # End-to-end tests
│   └── performance/    # Performance tests
├── k8s/                # Kubernetes configs
├── docker-compose.yml  # Docker orchestration
└── requirements.txt    # Python dependencies
```

**For Technical Review:**
- TypeScript API implementation with comprehensive testing
- Python ML integration for pattern analysis
- Docker multi-stage builds for API and ML services
- Kubernetes deployment configuration
- Database migration system
- Mobile-first PWA architecture

**Testing:**
Run test suite with: `npm run test:coverage`

</details>

**Note:** Personal meal tracking system demonstrating full-stack TypeScript/Python integration with ML analytics.

## License

MIT License - See LICENSE file
