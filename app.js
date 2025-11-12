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
const passwordDialog = document.getElementById('passwordDialog');
const passwordInput = document.getElementById('passwordInput');
const passwordSubmitBtn = document.getElementById('passwordSubmitBtn');
const passwordCancelBtn = document.getElementById('passwordCancelBtn');
const passwordError = document.getElementById('passwordError');

let extractedFiles = [];
let currentFile = null;
let currentZip = null;

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
    hidePasswordDialog();
    showProgress('ZIPファイルを読み込み中...');

    currentFile = file;
    
    // まずパスワードなしで試す
    await extractZip(file, null);
}

// ZIP解凍処理
async function extractZip(file, password) {
    showProgress('解凍中...');
    
    try {
        // zip.jsの設定
        const blobReader = new zip.BlobReader(file);
        const zipReader = new zip.ZipReader(blobReader, {
            password: password,
            // 日本語ファイル名対応: UTF-8とShift_JISの両方をサポート
            filenameEncoding: 'cp437',
            useWebWorkers: false
        });
        
        // ZIPファイルのエントリを取得
        const entries = await zipReader.getEntries();
        
        if (entries.length === 0) {
            await zipReader.close();
            throw new Error('ZIPファイルにファイルが含まれていません');
        }

        extractedFiles = [];
        let processed = 0;
        let encryptedDetected = false;

        // すべてのファイルを解凍
        for (const entry of entries) {
            if (!entry.directory) {
                try {
                    // ファイル名のデコード処理
                    let filename = entry.filename;
                    
                    // UTF-8フラグがない場合、Shift_JIS(CP932)として扱う可能性がある
                    if (!entry.filenameUTF8 && entry.rawFilename) {
                        try {
                            // rawFilenameからShift_JISデコードを試みる
                            const rawBytes = new Uint8Array(entry.rawFilename);
                            
                            // Encoding.jsを使用してShift_JISからUnicodeに変換
                            const unicodeArray = Encoding.convert(rawBytes, {
                                to: 'UNICODE',
                                from: 'SJIS'
                            });
                            
                            // UnicodeをStringに変換
                            const decodedName = Encoding.codeToString(unicodeArray);
                            
                            // 変換が成功したか確認（文字化けチェック）
                            if (decodedName && !decodedName.includes('�') && decodedName.length > 0) {
                                filename = decodedName;
                            }
                        } catch (decodeError) {
                            // デコード失敗時は元のファイル名を使用
                            console.warn('ファイル名のShift_JISデコードに失敗:', decodeError);
                        }
                    }
                    
                    // ファイルの内容を取得
                    const blobWriter = new zip.BlobWriter();
                    const blob = await entry.getData(blobWriter);
                    
                    extractedFiles.push({
                        name: filename,
                        size: blob.size,
                        blob: blob
                    });

                    processed++;
                    const progress = (processed / entries.filter(e => !e.directory).length) * 100;
                    updateProgress(progress, `解凍中... (${processed}/${entries.filter(e => !e.directory).length})`);
                } catch (err) {
                    // 暗号化エラーをチェック
                    console.error('ファイル解凍エラー:', err);
                    await zipReader.close();
                    
                    if (!password && entry.encrypted) {
                        // パスワードが必要
                        encryptedDetected = true;
                        break;
                    } else {
                        // パスワードが間違っている
                        throw new Error('incorrect password');
                    }
                }
            }
        }

        await zipReader.close();

        if (encryptedDetected) {
            hideProgress();
            showPasswordDialog();
            return;
        }

        // 解凍完了
        hideProgress();
        hidePasswordDialog();
        displayFiles();
        
    } catch (error) {
        console.error('ZIP解凍エラー:', error);
        hideProgress();
        
        // エラーメッセージを確認
        const errorMessage = error.message ? error.message.toLowerCase() : '';
        
        if (!password && (errorMessage.includes('encrypted') || errorMessage.includes('password'))) {
            // パスワードが必要
            showPasswordDialog();
        } else if (password && (errorMessage.includes('password') || errorMessage.includes('incorrect'))) {
            // パスワードが間違っている
            showPasswordDialog();
            showPasswordError('パスワードが正しくありません');
        } else {
            showError('ZIPファイルの解凍に失敗しました: ' + error.message);
        }
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

// パスワードダイアログの表示
function showPasswordDialog() {
    passwordDialog.style.display = 'flex';
    passwordInput.value = '';
    passwordInput.focus();
    hidePasswordError();
}

// パスワードダイアログの非表示
function hidePasswordDialog() {
    passwordDialog.style.display = 'none';
    passwordInput.value = '';
    hidePasswordError();
}

// パスワードエラーの表示
function showPasswordError(message) {
    passwordError.textContent = message;
    passwordError.style.display = 'block';
}

// パスワードエラーの非表示
function hidePasswordError() {
    passwordError.style.display = 'none';
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
        // zip.jsを使用してZIPファイルを作成
        const blobWriter = new zip.BlobWriter('application/zip');
        const zipWriter = new zip.ZipWriter(blobWriter);

        let processed = 0;
        for (const file of extractedFiles) {
            await zipWriter.add(file.name, new zip.BlobReader(file.blob));
            processed++;
            const progress = (processed / extractedFiles.length) * 100;
            updateProgress(progress, `ZIPファイルを作成中... (${progress.toFixed(0)}%)`);
        }

        const blob = await zipWriter.close();

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

// パスワード送信ボタンのイベント
passwordSubmitBtn.addEventListener('click', async () => {
    const password = passwordInput.value;
    
    if (!password) {
        showPasswordError('パスワードを入力してください');
        return;
    }
    
    hidePasswordError();
    hidePasswordDialog();
    
    try {
        await extractZip(currentFile, password);
    } catch (error) {
        console.error('パスワード解凍エラー:', error);
        hideProgress();
        
        if (error.message && (
            error.message.includes('Encrypted') || 
            error.message.includes('password') ||
            error.message.includes('incorrect') ||
            error.message.includes('invalid')
        )) {
            showPasswordDialog();
            showPasswordError('パスワードが正しくありません');
        } else {
            showError('ZIPファイルの解凍に失敗しました: ' + error.message);
        }
    }
});

// パスワードキャンセルボタンのイベント
passwordCancelBtn.addEventListener('click', () => {
    hidePasswordDialog();
    currentFile = null;
    currentZip = null;
});

// パスワード入力でEnterキーを押した時
passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        passwordSubmitBtn.click();
    }
});
