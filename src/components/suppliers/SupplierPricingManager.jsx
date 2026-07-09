try {
        const uploadResult = await db.integrations.Ocr.uploadFile(ocrFile);
        if (!uploadResult.success) throw new Error('Upload failed');
        const result = await db.integrations.Ocr.extract(uploadResult.file_path, 'tur+eng', true, primaryCategoryName);
        setOcrResult(result);
        if (result.parsed?.rows) {
          setOcrSelectedRows(result.parsed.rows.map((_, i) => i));