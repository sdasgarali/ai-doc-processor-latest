import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  LinearProgress,
  Card,
  CardContent,
  Chip,
  Stack,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  CloudDone as CloudDoneIcon
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { toast } from 'react-toastify';

const Upload = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [category, setCategory] = useState('');
  const [model, setModel] = useState('');
  const [models, setModels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});

  // Fetch categories and models on component mount
  useEffect(() => {
    fetchCategories();
    fetchModels();
  }, []);

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/admin/categories', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setCategories(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      // Use default categories if API fails
      setCategories([
        { category_id: 1, category_name: 'eob', category_description: 'Explanation of Benefits' },
        { category_id: 2, category_name: 'facesheet', category_description: 'Patient Facesheet' }
      ]);
    }
  };

  const fetchModels = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/admin/models', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setModels(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching models:', error);
      setModels([]);
    }
  };

  const onDrop = useCallback((acceptedFiles) => {
    const pdfFiles = acceptedFiles.filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length !== acceptedFiles.length) {
      toast.warning('Only PDF files are accepted');
    }

    const newFiles = pdfFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending',
      progress: 0
    }));

    setSelectedFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: true
  });

  const removeFile = (fileId) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select at least one file');
      return;
    }

    if (!category) {
      toast.error('Please select a document category');
      return;
    }

    setUploading(true);

    for (const fileItem of selectedFiles) {
      if (fileItem.status === 'success') continue;

      try {
        const formData = new FormData();
        formData.append('file', fileItem.file);
        formData.append('doc_category', category);
        if (model) {
          formData.append('model_id', model);
        }

        const token = localStorage.getItem('token');
        
        setUploadProgress(prev => ({
          ...prev,
          [fileItem.id]: { status: 'uploading', progress: 0 }
        }));

        const response = await axios.post('/api/documents/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(prev => ({
              ...prev,
              [fileItem.id]: { status: 'uploading', progress: percentCompleted }
            }));
          }
        });

        if (response.data.success) {
          setUploadProgress(prev => ({
            ...prev,
            [fileItem.id]: { status: 'success', progress: 100 }
          }));
          
          setSelectedFiles(prev =>
            prev.map(f =>
              f.id === fileItem.id ? { ...f, status: 'success', processId: response.data.process_id } : f
            )
          );

          toast.success(`${fileItem.file.name} uploaded successfully! Processing started.`);
        }
      } catch (error) {
        console.error('Upload error:', error);
        setUploadProgress(prev => ({
          ...prev,
          [fileItem.id]: { status: 'error', progress: 0 }
        }));
        
        setSelectedFiles(prev =>
          prev.map(f =>
            f.id === fileItem.id ? { ...f, status: 'error' } : f
          )
        );

        const errorMessage = error.response?.data?.message || 'Upload failed';
        toast.error(`${fileItem.file.name}: ${errorMessage}`);
      }
    }

    setUploading(false);
  };

  const getFileIcon = (fileItem) => {
    const progress = uploadProgress[fileItem.id];
    
    if (fileItem.status === 'success' || progress?.status === 'success') {
      return <CheckCircleIcon color="success" />;
    }
    if (fileItem.status === 'error' || progress?.status === 'error') {
      return <ErrorIcon color="error" />;
    }
    return <CloudUploadIcon color="action" />;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Upload Documents
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>📤 Automatic Google Drive Backup</strong><br />
          Uploaded files are automatically saved locally and backed up to Google Drive 
          (folder: <code>eob-source</code>, configurable in .env).
          Processing continues even if Google Drive is not configured.
        </Typography>
      </Alert>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Select Files
        </Typography>

        <Box
          {...getRootProps()}
          sx={{
            border: '2px dashed',
            borderColor: isDragActive ? 'primary.main' : 'grey.400',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            cursor: 'pointer',
            bgcolor: isDragActive ? 'action.hover' : 'background.paper',
            transition: 'all 0.3s',
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: 'action.hover'
            }
          }}
        >
          <input {...getInputProps()} />
          <CloudUploadIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
          {isDragActive ? (
            <Typography variant="h6">Drop the PDF files here...</Typography>
          ) : (
            <>
              <Typography variant="h6" gutterBottom>
                Drag & Drop PDF files here
              </Typography>
              <Typography variant="body2" color="text.secondary">
                or click to browse files
              </Typography>
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                Supported: PDF files only
              </Typography>
            </>
          )}
        </Box>

        {selectedFiles.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Selected Files ({selectedFiles.length})
            </Typography>
            <List>
              {selectedFiles.map((fileItem) => {
                const progress = uploadProgress[fileItem.id];
                return (
                  <Card key={fileItem.id} sx={{ mb: 1 }}>
                    <CardContent>
                      <ListItem disablePadding>
                        <Box sx={{ mr: 2 }}>
                          {getFileIcon(fileItem)}
                        </Box>
                        <ListItemText
                          primary={fileItem.file.name}
                          secondary={
                            <Stack direction="row" spacing={2}>
                              <span>{formatFileSize(fileItem.file.size)}</span>
                              {fileItem.status === 'success' && (
                                <Chip
                                  icon={<CloudDoneIcon />}
                                  label="Uploaded & Backed up to Drive"
                                  color="success"
                                  size="small"
                                />
                              )}
                              {fileItem.status === 'error' && (
                                <Chip label="Upload Failed" color="error" size="small" />
                              )}
                            </Stack>
                          }
                        />
                        <ListItemSecondaryAction>
                          {fileItem.status !== 'success' && !uploading && (
                            <IconButton
                              edge="end"
                              onClick={() => removeFile(fileItem.id)}
                              color="error"
                            >
                              <DeleteIcon />
                            </IconButton>
                          )}
                        </ListItemSecondaryAction>
                      </ListItem>
                      {progress?.status === 'uploading' && (
                        <Box sx={{ mt: 1 }}>
                          <LinearProgress variant="determinate" value={progress.progress} />
                          <Typography variant="caption" color="text.secondary">
                            Uploading... {progress.progress}%
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </List>
          </Box>
        )}
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Document Settings
        </Typography>

        <Stack spacing={3}>
          <FormControl fullWidth required>
            <InputLabel>Document Category</InputLabel>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              label="Document Category"
            >
              {categories.map((cat) => (
                <MenuItem key={cat.category_id} value={cat.category_id}>
                  {cat.category_name.toUpperCase()} - {cat.category_description}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Extraction Model (Optional)</InputLabel>
            <Select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              label="Extraction Model (Optional)"
            >
              <MenuItem value="">
                <em>Use Default Model</em>
              </MenuItem>
              {models.map((m) => (
                <MenuItem key={m.model_id} value={m.model_id}>
                  {m.model_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {selectedFiles.length} file(s) selected
        </Typography>
        <Button
          variant="contained"
          size="large"
          startIcon={<CloudUploadIcon />}
          onClick={handleUpload}
          disabled={uploading || selectedFiles.length === 0 || !category}
        >
          {uploading ? 'Uploading...' : 'Upload & Process'}
        </Button>
      </Box>

      {selectedFiles.some(f => f.status === 'success') && (
        <Alert severity="success" sx={{ mt: 3 }}>
          <Typography variant="body2">
            <strong>✅ Upload Complete!</strong><br />
            Files have been uploaded successfully and backed up to Google Drive.
            Processing has started. Check the Documents page to monitor progress.
          </Typography>
        </Alert>
      )}
    </Box>
  );
};

export default Upload;
