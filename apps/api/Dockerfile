FROM python:3.12-slim

WORKDIR /srv
COPY apps/api/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/api/app ./app
COPY packages/widget/dist/widget.js ./widget.js

ENV WIDGET_BUNDLE=/srv/widget.js
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
