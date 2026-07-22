from django.urls import path
from . import views

urlpatterns = [
    path('plan-trip/', views.plan_trip, name='plan_trip'),
    path('health/', views.health_check, name='health_check'),
]
