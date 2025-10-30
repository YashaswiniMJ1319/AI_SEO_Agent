# models.py
from sqlalchemy import Column, Integer, String, Float, DateTime
from datetime import datetime
from db import Base

class BehaviorLog(Base):
    __tablename__ = "behavior_logs"

    id = Column(Integer, primary_key=True, index=True)
    page_url = Column(String, nullable=False)
    time_spent_seconds = Column(Float)
    scroll_depth_percent = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)
    user_agent = Column(String)
