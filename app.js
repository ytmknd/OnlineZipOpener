// DOM要素の取得
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const selectBtn = document.getElementById('selectBtn');
const progressSection = document.getElementById('progressSection');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const errorSection = document.getElementById('errorSection');
const errorText = document.getElementById('errorText');
const filesSection = document.getElementById('filesSection');
const fileList = document.getElementById('fileList');
const fileCount = document.getElementById('fileCount');
const downloadAllBtn = document.getElementById('downloadAllBtn');

let extractedFiles = [];

// ファイル選択ボタンのクリックイベント
selectBtn.addEventListener('click', () => {
    fileInput.click();
});

// ファイル入力の変更イベント
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
});

// ドラッグ&ドロップのイベント
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
    
    const file = e.dataTransfer.files[0];
    if (file) {
        handleFile(file);
    }
});

// ファイル処理のメイン関数
async function handleFile(file) {
    // ZIPファイルかチェック
    if (!file.name.toLowerCase().endsWith('.zip')) {
        showError('ZIPファイルを選択してください');
        return;
    }

    // UI状態のリセット
    hideError();
    hideFiles();
    showProgress('ZIPファイルを読み込み中...');

    try {
        // ZIPファイルの読み込み
        const arrayBuffer = await file.arrayBuffer();
        
        showProgress('解凍中...');
        
        // JSZipで解凍
        const zip = await JSZip.loadAsync(arrayBuffer);
        
        extractedFiles = [];
        const files = [];
        
        // すべてのファイルを取得
        zip.forEach((relativePath, zipEntry) => {
            if (!zipEntry.dir) {
                files.push({ path: relativePath, entry: zipEntry });
            }
        });

        // プログレスバー更新のための処理
        let processed = 0;
        for (const fileData of files) {
            const { path, entry } = fileData;
            
            // ファイルの内容を取得
            const blob = await entry.async('blob');
            
            extractedFiles.push({
                name: path,
                size: blob.size,
                blob: blob
            });

            processed++;
            const progress = (processed / files.length) * 100;
            updateProgress(progress, `解凍中... (${processed}/${files.length})`);
        }

        // 解凍完了
        hideProgress();
        displayFiles();
        
    } catch (error) {
        console.error('解凍エラー:', error);
        hideProgress();
        showError('ZIPファイルの解凍に失敗しました: ' + error.message);
    }
}

// プログレスバーの表示
function showProgress(text) {
    progressSection.style.display = 'block';
    progressText.textContent = text;
    progressFill.style.width = '0%';
}

// プログレスバーの更新
function updateProgress(percent, text) {
    progressFill.style.width = percent + '%';
    progressText.textContent = text;
}

// プログレスバーの非表示
function hideProgress() {
    progressSection.style.display = 'none';
}

// エラー表示
function showError(message) {
    errorText.textContent = message;
    errorSection.style.display = 'block';
}

// エラー非表示
function hideError() {
    errorSection.style.display = 'none';
}

// ファイルリストの非表示
function hideFiles() {
    filesSection.style.display = 'none';
}

// ファイルリストの表示
function displayFiles() {
    if (extractedFiles.length === 0) {
        showError('ZIPファイルにファイルが含まれていません');
        return;
    }

    filesSection.style.display = 'block';
    fileCount.textContent = `${extractedFiles.length} 個のファイル`;
    
    fileList.innerHTML = '';
    
    extractedFiles.forEach((file, index) => {
        const fileItem = createFileItem(file, index);
        fileList.appendChild(fileItem);
    });
}

// ファイルアイテムの作成
function createFileItem(file, index) {
    const div = document.createElement('div');
    div.className = 'file-item';
    
    const fileIcon = getFileIcon(file.name);
    const fileSize = formatFileSize(file.size);
    
    div.innerHTML = `
        <div class="file-info">
            <span class="file-icon">${fileIcon}</span>
            <div class="file-details">
                <div class="file-name">${escapeHtml(file.name)}</div>
                <div class="file-meta">${fileSize}</div>
            </div>
        </div>
        <button class="btn-download" onclick="downloadFile(${index})">ダウンロード</button>
    `;
    
    return div;
}

// ファイルアイコンの取得
function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const iconMap = {
        'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'bmp': '🖼️', 'svg': '🖼️',
        'mp4': '🎬', 'avi': '🎬', 'mov': '🎬', 'wmv': '🎬', 'flv': '🎬', 'mkv': '🎬',
        'mp3': '🎵', 'wav': '🎵', 'flac': '🎵', 'aac': '🎵', 'm4a': '🎵',
        'pdf': '📕',
        'doc': '📘', 'docx': '📘', 'odt': '📘',
        'xls': '📗', 'xlsx': '📗', 'ods': '📗',
        'ppt': '📙', 'pptx': '📙', 'odp': '📙',
        'zip': '🗜️', 'rar': '🗜️', '7z': '🗜️', 'tar': '🗜️', 'gz': '🗜️',
        'txt': '📄', 'md': '📄',
        'html': '🌐', 'htm': '🌐', 'css': '🌐', 'js': '🌐',
        'exe': '⚙️', 'msi': '⚙️', 'app': '⚙️',
    };
    return iconMap[ext] || '📄';
}

// ファイルサイズのフォーマット
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// HTMLエスケープ
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 個別ファイルのダウンロード
function downloadFile(index) {
    const file = extractedFiles[index];
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name.split('/').pop(); // ディレクトリパスを除去
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// すべてのファイルをZIPでダウンロード
downloadAllBtn.addEventListener('click', async () => {
    if (extractedFiles.length === 0) return;

    showProgress('ZIPファイルを作成中...');

    try {
        const zip = new JSZip();

        extractedFiles.forEach(file => {
            zip.file(file.name, file.blob);
        });

        const blob = await zip.generateAsync(
            { type: 'blob' },
            (metadata) => {
                const progress = metadata.percent;
                updateProgress(progress, `ZIPファイルを作成中... (${progress.toFixed(0)}%)`);
            }
        );

        hideProgress();

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'extracted_files.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error('ZIP作成エラー:', error);
        hideProgress();
        showError('ZIPファイルの作成に失敗しました');
    }
});
