class UploadController {
    constructor() {
        this.files = [
            {
                id: 1,
                name: 'Contrato_Servicios_2024.pdf',
                size: 2458192,
                type: 'application/pdf',
                uploadDate: '2024-01-15T10:30:00',
                uploadedBy: 'admin@docuflow.com'
            },
            {
                id: 2,
                name: 'Factura_ENE_2024.xlsx',
                size: 156789,
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                uploadDate: '2024-01-14T14:22:00',
                uploadedBy: 'contabilidad@empresa.com'
            },
            {
                id: 3,
                name: 'Manual_Usuario.docx',
                size: 3456789,
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                uploadDate: '2024-01-13T09:15:00',
                uploadedBy: 'documentacion@empresa.com'
            }
        ];
        
        this.initializeEventListeners();
        this.renderFiles();
        this.updateStatistics();
    }

    initializeEventListeners() {
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            this.handleFileSelection(e.dataTransfer.files);
        });

        dropZone.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            this.handleFileSelection(e.target.files);
        });

        document.getElementById('uploadBtn').addEventListener('click', () => {
            this.uploadFiles();
        });

        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filterFiles(e.target.value);
        });
    }

    handleFileSelection(files) {
        const fileList = document.getElementById('selectedFiles');
        fileList.innerHTML = '';

        Array.from(files).forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'selected-file-item d-flex justify-content-between align-items-center p-2 border rounded mb-2';
            fileItem.innerHTML = `
                <div>
                    <strong>${file.name}</strong>
                    <small class="text-muted d-block">${this.formatFileSize(file.size)}</small>
                </div>
                <button type="button" class="btn btn-sm btn-outline-danger" onclick="this.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            `;
            fileList.appendChild(fileItem);
        });

        document.getElementById('uploadBtn').disabled = files.length === 0;
    }

    uploadFiles() {
        const fileItems = document.querySelectorAll('.selected-file-item');
        
        if (fileItems.length === 0) {
            this.showNotification('Selecciona al menos un archivo para subir', 'warning');
            return;
        }

        fileItems.forEach((item, index) => {
            const fileName = item.querySelector('strong').textContent;
            const fileSize = Math.floor(Math.random() * 5000000) + 100000;
            
            const newFile = {
                id: this.files.length + index + 1,
                name: fileName,
                size: fileSize,
                type: this.getFileType(fileName),
                uploadDate: new Date().toISOString(),
                uploadedBy: 'usuario@empresa.com'
            };
            
            this.files.unshift(newFile);
        });

        this.renderFiles();
        this.updateStatistics();
        
        document.getElementById('selectedFiles').innerHTML = '';
        document.getElementById('fileInput').value = '';
        document.getElementById('uploadBtn').disabled = true;

        const modal = bootstrap.Modal.getInstance(document.getElementById('uploadModal'));
        modal.hide();

        this.showNotification(`${fileItems.length} archivo(s) subido(s) correctamente`, 'success');
    }

    downloadFile(fileId) {
        const file = this.files.find(f => f.id === fileId);
        if (file) {
            this.showNotification(`Descargando ${file.name}...`, 'info');
            setTimeout(() => {
                this.showNotification(`${file.name} descargado correctamente`, 'success');
            }, 1500);
        }
    }

    deleteFile(fileId) {
        const file = this.files.find(f => f.id === fileId);
        if (file) {
            document.getElementById('deleteFileName').textContent = file.name;
            document.getElementById('confirmDeleteBtn').onclick = () => {
                this.confirmDelete(fileId);
            };
            
            const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
            modal.show();
        }
    }

    confirmDelete(fileId) {
        const fileIndex = this.files.findIndex(f => f.id === fileId);
        if (fileIndex > -1) {
            const fileName = this.files[fileIndex].name;
            this.files.splice(fileIndex, 1);
            this.renderFiles();
            this.updateStatistics();
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('deleteModal'));
            modal.hide();
            
            this.showNotification(`${fileName} eliminado correctamente`, 'success');
        }
    }

    renderFiles() {
        const tbody = document.getElementById('filesTableBody');
        tbody.innerHTML = '';

        this.files.forEach(file => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div class="d-flex align-items-center">
                        <i class="${this.getFileIcon(file.type)} me-2"></i>
                        <span>${file.name}</span>
                    </div>
                </td>
                <td>${this.formatFileSize(file.size)}</td>
                <td>${this.formatDate(file.uploadDate)}</td>
                <td>${file.uploadedBy}</td>
                <td>
                    <div class="btn-group" role="group">
                        <button type="button" class="btn btn-sm btn-outline-primary" onclick="uploadController.downloadFile(${file.id})" title="Descargar">
                            <i class="fas fa-download"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-danger" onclick="uploadController.deleteFile(${file.id})" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    filterFiles(searchTerm) {
        const rows = document.querySelectorAll('#filesTableBody tr');
        
        rows.forEach(row => {
            const fileName = row.cells[0].textContent.toLowerCase();
            const match = fileName.includes(searchTerm.toLowerCase());
            row.style.display = match ? '' : 'none';
        });
    }

    updateStatistics() {
        const totalFiles = this.files.length;
        const totalSize = this.files.reduce((sum, file) => sum + file.size, 0);
        const todayUploads = this.files.filter(file => {
            const uploadDate = new Date(file.uploadDate);
            const today = new Date();
            return uploadDate.toDateString() === today.toDateString();
        }).length;

        document.getElementById('totalFiles').textContent = totalFiles;
        document.getElementById('totalSize').textContent = this.formatFileSize(totalSize);
        document.getElementById('todayUploads').textContent = todayUploads;
    }

    getFileIcon(type) {
        const iconMap = {
            'application/pdf': 'fas fa-file-pdf text-danger',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'fas fa-file-word text-primary',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'fas fa-file-excel text-success',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'fas fa-file-powerpoint text-warning',
            'text/csv': 'fas fa-file-csv text-info',
            'image/jpeg': 'fas fa-file-image text-success',
            'image/png': 'fas fa-file-image text-success',
            'text/plain': 'fas fa-file-alt text-secondary'
        };
        
        return iconMap[type] || 'fas fa-file text-secondary';
    }

    getFileType(fileName) {
        const extension = fileName.split('.').pop().toLowerCase();
        const typeMap = {
            'pdf': 'application/pdf',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'csv': 'text/csv',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'txt': 'text/plain'
        };
        
        return typeMap[extension] || 'application/octet-stream';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

let uploadController;
document.addEventListener('DOMContentLoaded', () => {
    uploadController = new UploadController();
});