import * as fs from 'fs';
import * as path from 'path';
import { processXml, processText, ProcessOptions } from './process';

function getAllFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllFiles(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

function copyDir(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function processDirectory(inputDir: string, outputDir: string, baseOptions: Partial<ProcessOptions>) {
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true });
  }
  copyDir(inputDir, outputDir);

  const allFiles = getAllFiles(outputDir);
  for (const file of allFiles) {
    const ext = path.extname(file).toLowerCase();
    const lowerPath = file.toLowerCase().replace(/\\/g, '/');

    if (ext === '.txt') {
      // TXT files: always RTL fix only, never word wrap
      const content = fs.readFileSync(file, 'utf-8');
      const processed = processText(content, {
        wrapLength: 0,
        applyRtlFix: true,
        applyWordWrap: false,
      });
      fs.writeFileSync(file, processed, 'utf-8');
      console.log(`  [TXT] Processed: ${file}`);

    } else if (ext === '.xml') {
      const content = fs.readFileSync(file, 'utf-8');

      // Per-file exceptions for word wrap length
      let options = { ...baseOptions };

      const isTipsXml = lowerPath.endsWith('tips.xml');
      const isIdeoPresetDefsXml = lowerPath.includes('ideopresetcategorydef') && lowerPath.endsWith('ideopresetdefs.xml');
      const isDesignatorsXml = lowerPath.includes('data/core/languages') && lowerPath.includes('keyed') && lowerPath.endsWith('designators.xml');
      // Matches messages.xml inside any keyed folder (Core or DLCs)
      const isMessagesXml = lowerPath.includes('/keyed/') && lowerPath.endsWith('messages.xml');

      if (isTipsXml) {
        // Tips need longer wrap length
        options.applyWordWrap = true;
        options.wrapLength = 100;
      } else if (isMessagesXml) {
        // Upper-left notifications exception
        options.applyWordWrap = true;
        options.wrapLength = 110;
      } else if (isIdeoPresetDefsXml) {
        options.applyWordWrap = true;
        options.wrapLength = 50;
      } else if (isDesignatorsXml) {
        options.applyWordWrap = true;
        options.wrapLength = 25;
      }

      try {
        const processed = processXml(content, options);
        fs.writeFileSync(file, processed, 'utf-8');
        console.log(`  [XML] Processed: ${file}`);
      } catch (err) {
        console.error(`  [ERROR] Skipping ${file}:`, err);
      }
    }
  }
}

function copyModDirectory(inputDir: string, outputDir: string) {
  if (!fs.existsSync(inputDir)) {
    console.error(`  [ERROR] Mod source folder not found: ${inputDir}`);
    return;
  }
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true });
  }
  copyDir(inputDir, outputDir);
  console.log(`  [MOD] Copied: ${inputDir} -> ${outputDir}`);
}

const dataDir = path.resolve(__dirname, '../Data');
const modsDir = path.resolve(__dirname, '../Mods');
const outDir  = path.resolve(__dirname, '../dist');

fs.mkdirSync(outDir, { recursive: true });

console.log('\n[1/3] Building Data-Normal (RTL fix only)...');
processDirectory(dataDir, path.join(outDir, 'Data-Normal/Data'), {
  applyRtlFix: true,
  applyWordWrap: false,
  wrapLength: 30,
});

console.log('\n[2/3] Building Data-WordWrap (RTL fix + word wrap)...');
processDirectory(dataDir, path.join(outDir, 'Data-WordWrap/Data'), {
  applyRtlFix: true,
  applyWordWrap: true,
  wrapLength: 30,
});

console.log('\n[3/3] Building Data-ArabicSupport (RTL fix only + ArabicSupport mod)...');
processDirectory(dataDir, path.join(outDir, 'Data-ArabicSupport/Data'), {
  applyRtlFix: true,
  applyWordWrap: false,
  wrapLength: 30,
});
copyModDirectory(path.join(modsDir, 'ArabicSupport'), path.join(outDir, 'Data-ArabicSupport/Mods/ArabicSupport'));

console.log('\n✅ All variants built in /dist/');
