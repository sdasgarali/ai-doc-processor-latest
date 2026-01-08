"""
Google Drive Service Module
Handles file upload, download, and management with Google Drive API
"""

import io
import logging
from pathlib import Path
from typing import Optional, Dict, Any, BinaryIO

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseUpload, MediaIoBaseDownload

from config import config

logger = logging.getLogger(__name__)


class GoogleDriveService:
    """Google Drive API service wrapper"""

    SCOPES = ['https://www.googleapis.com/auth/drive']

    def __init__(self):
        self.credentials = None
        self.service = None
        self._initialize_service()

    def _initialize_service(self):
        """Initialize Google Drive API service"""
        try:
            creds_file = config.google_drive.credentials_file
            if not creds_file or not Path(creds_file).exists():
                logger.error("Google Drive credentials file not found")
                return

            self.credentials = service_account.Credentials.from_service_account_file(
                creds_file, scopes=self.SCOPES
            )
            self.service = build('drive', 'v3', credentials=self.credentials)
            logger.info("Google Drive service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Google Drive service: {e}")

    def download_file(self, file_id: str, destination_path: str) -> bool:
        """Download a file from Google Drive"""
        if not self.service:
            logger.error("Google Drive service not initialized")
            return False

        try:
            request = self.service.files().get_media(fileId=file_id)
            fh = io.BytesIO()
            downloader = MediaIoBaseDownload(fh, request)

            done = False
            while not done:
                status, done = downloader.next_chunk()
                if status:
                    logger.debug(f"Download {int(status.progress() * 100)}%")

            fh.seek(0)
            with open(destination_path, 'wb') as f:
                f.write(fh.read())

            logger.info(f"Downloaded file to: {destination_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to download file {file_id}: {e}")
            return False

    def upload_file(self, file_path: str, folder_id: str = None,
                    mime_type: str = None) -> Optional[Dict]:
        """Upload a file to Google Drive"""
        if not self.service:
            logger.error("Google Drive service not initialized")
            return None

        try:
            file_name = Path(file_path).name

            if mime_type is None:
                mime_type = self._get_mime_type(file_path)

            file_metadata = {'name': file_name}
            if folder_id:
                file_metadata['parents'] = [folder_id]

            media = MediaFileUpload(file_path, mimetype=mime_type)
            file = self.service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id, name, webViewLink, webContentLink'
            ).execute()

            logger.info(f"Uploaded file: {file_name} (ID: {file.get('id')})")
            return file
        except Exception as e:
            logger.error(f"Failed to upload file {file_path}: {e}")
            return None

    def upload_content(self, content: bytes, file_name: str, folder_id: str = None,
                       mime_type: str = 'application/octet-stream') -> Optional[Dict]:
        """Upload content directly to Google Drive"""
        if not self.service:
            logger.error("Google Drive service not initialized")
            return None

        try:
            file_metadata = {'name': file_name}
            if folder_id:
                file_metadata['parents'] = [folder_id]

            fh = io.BytesIO(content)
            media = MediaIoBaseUpload(fh, mimetype=mime_type)
            file = self.service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id, name, webViewLink, webContentLink'
            ).execute()

            logger.info(f"Uploaded content as: {file_name} (ID: {file.get('id')})")
            return file
        except Exception as e:
            logger.error(f"Failed to upload content as {file_name}: {e}")
            return None

    def upload_json(self, data: Dict, file_name: str, folder_id: str = None) -> Optional[Dict]:
        """Upload JSON data to Google Drive"""
        import json
        content = json.dumps(data, indent=2, ensure_ascii=False).encode('utf-8')
        return self.upload_content(content, file_name, folder_id, 'application/json')

    def upload_csv(self, csv_content: str, file_name: str, folder_id: str = None) -> Optional[Dict]:
        """Upload CSV content to Google Drive"""
        content = csv_content.encode('utf-8')
        return self.upload_content(content, file_name, folder_id, 'text/csv')

    def move_file(self, file_id: str, new_folder_id: str) -> bool:
        """Move a file to a different folder"""
        if not self.service:
            logger.error("Google Drive service not initialized")
            return False

        try:
            # Get current parents
            file = self.service.files().get(
                fileId=file_id, fields='parents'
            ).execute()
            previous_parents = ",".join(file.get('parents', []))

            # Move file
            self.service.files().update(
                fileId=file_id,
                addParents=new_folder_id,
                removeParents=previous_parents,
                fields='id, parents'
            ).execute()

            logger.info(f"Moved file {file_id} to folder {new_folder_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to move file {file_id}: {e}")
            return False

    def rename_file(self, file_id: str, new_name: str) -> bool:
        """Rename a file in Google Drive"""
        if not self.service:
            logger.error("Google Drive service not initialized")
            return False

        try:
            self.service.files().update(
                fileId=file_id,
                body={'name': new_name}
            ).execute()

            logger.info(f"Renamed file {file_id} to {new_name}")
            return True
        except Exception as e:
            logger.error(f"Failed to rename file {file_id}: {e}")
            return False

    def get_file_info(self, file_id: str) -> Optional[Dict]:
        """Get file metadata from Google Drive"""
        if not self.service:
            logger.error("Google Drive service not initialized")
            return None

        try:
            file = self.service.files().get(
                fileId=file_id,
                fields='id, name, mimeType, size, webViewLink, webContentLink, parents'
            ).execute()
            return file
        except Exception as e:
            logger.error(f"Failed to get file info for {file_id}: {e}")
            return None

    def list_files(self, folder_id: str = None, page_size: int = 100) -> list:
        """List files in a folder or root"""
        if not self.service:
            logger.error("Google Drive service not initialized")
            return []

        try:
            query = ""
            if folder_id:
                query = f"'{folder_id}' in parents"

            results = self.service.files().list(
                q=query,
                pageSize=page_size,
                fields="nextPageToken, files(id, name, mimeType, size, createdTime)"
            ).execute()

            return results.get('files', [])
        except Exception as e:
            logger.error(f"Failed to list files: {e}")
            return []

    def _get_mime_type(self, file_path: str) -> str:
        """Determine MIME type based on file extension"""
        extension = Path(file_path).suffix.lower()
        mime_types = {
            '.pdf': 'application/pdf',
            '.json': 'application/json',
            '.csv': 'text/csv',
            '.txt': 'text/plain',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.xls': 'application/vnd.ms-excel',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
        }
        return mime_types.get(extension, 'application/octet-stream')
