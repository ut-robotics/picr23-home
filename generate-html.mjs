import child_process from 'node:child_process';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import util from 'node:util';

const execPromise = util.promisify(child_process.exec);

async function processLinks(filename) {
    let content = await fsPromises.readFile(filename, 'utf8');

    content = content.replace(/(<a.*)(\.asciidoc)(.*<\/a>)/g, '$1.html$3');

    await fsPromises.writeFile(filename, content, 'utf8');
}

async function* getFiles(dir) {
    const dirents = await fsPromises.readdir(dir, {withFileTypes: true});

    for (const dirent of dirents) {
        const res = path.resolve(dir, dirent.name);

        if (dirent.isDirectory()) {
            yield* getFiles(res);
        } else {
            yield res;
        }
    }
}

console.log('Convert asciidoc to HTML and copy other files:');

const sourceDir = 'source';
const destDir = 'docs';
const cssFile = 'asciidoctor.css';
const asciidoctorPromises = [];

for await (const filename of getFiles(sourceDir)) {
    if (filename.endsWith('.asciidoc')) {
        const relativePath = path.relative(sourceDir, filename);
        const relativeDestinationPath = path.join(destDir, relativePath);
        const relativeDestinationDirectoryPath = path.dirname(relativeDestinationPath);
        const relativeCssDirectoryPath = path.relative(relativeDestinationDirectoryPath, destDir);
        const cssPath = path.join(relativeCssDirectoryPath, cssFile);

        console.log(relativePath);

        asciidoctorPromises.push(execPromise(`asciidoctor -a nofooter -a linkcss -a stylesheet=${cssPath} -R ${sourceDir} -D ${destDir} ${filename}`));

        continue;
    }

    const toFilename = path.join(destDir, path.relative(sourceDir, filename));

    console.log(toFilename);

    await fsPromises.mkdir(path.dirname(toFilename), {recursive: true});
    await fsPromises.copyFile(filename, toFilename);
}

await Promise.all(asciidoctorPromises);

console.log('Process links:');

const htmlProcessingPromises = [];

for await (const filename of getFiles('docs')) {
    if (!filename.endsWith('.html')) {
        continue;
    }

    console.log(filename);
    htmlProcessingPromises.push(processLinks(filename));
}

await Promise.all(htmlProcessingPromises);