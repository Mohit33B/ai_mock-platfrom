from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register_user, name='register'),
    path('login/', views.login_user, name='login'),
    path('tests/', views.get_all_tests, name='get_all_tests'),
    path('tests/<int:test_id>/', views.get_single_test, name='get_single_test'),
    path('tests/<int:test_id>/autosave/', views.auto_save_progress, name='autosave_progress'),
    path('tests/<int:test_id>/submit/', views.submit_test, name='submit_test'),
    path('upload-json-bank/', views.upload_json_bank, name='upload_json_bank'),
    path('merge_to_full_mock/', views.merge_to_full_mock, name='merge_to_full_mock'),
    path('merge-full-mock/', views.merge_to_full_mock, name='merge_full_mock'),
]