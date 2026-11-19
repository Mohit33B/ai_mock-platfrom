from django.db import models
from django.contrib.auth.models import User

class MockTest(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    exam_category = models.CharField(max_length=100)
    test_type = models.CharField(max_length=50, default="PYQ Sectional") 
    time_limit = models.IntegerField(default=15) # in minutes
    language = models.CharField(max_length=50, default="English")
    questions_data = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} ({self.exam_category})"

class TestResult(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    mock_test = models.ForeignKey(MockTest, on_delete=models.CASCADE)
    score = models.FloatField(default=0.0)
    accuracy = models.FloatField(default=0.0)
    correct_count = models.IntegerField(default=0)
    wrong_count = models.IntegerField(default=0)
    unattempted_count = models.IntegerField(default=0)
    section_breakdown = models.JSONField(default=dict)
    attempt_history_type = models.CharField(max_length=20, default="1st Attempt")
    submitted_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.mock_test.title} [Score: {self.score}]"

class TestProgress(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    mock_test = models.ForeignKey(MockTest, on_delete=models.CASCADE)
    saved_answers = models.JSONField(default=dict)
    marked_for_review = models.JSONField(default=dict)
    current_question_index = models.IntegerField(default=0)
    time_left_seconds = models.IntegerField(default=900)
    is_completed = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'mock_test')