import examplesData from '../examples/manifest.json' with {type: 'json'};

/* Brett Meyer - Broken Pony Club */

const bpc = {};

function getParameterByName(name) {
    const match = RegExp(`[?&]${name}=([^&]*)`).exec(window.location.search);
    return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
}

function getMajorPixiVersion(pixiVersionString) {
    let majorVersion = 7;

    if (pixiVersionString.substr(0, 1) === 'v') {
        majorVersion = parseInt(pixiVersionString.substr(1, 1), 10);
    }

    return majorVersion;
}

function reload() {
    if (bpc.editor) bpc.exampleSourceCode = bpc.editor.getValue();
    bpc.generateIFrameContent();
}

jQuery(document).ready(($) => {
    window.onpopstate = function onpopstate(event) {
        bpc.pixiVersionString = getParameterByName('v') || 'dev';
        bpc.generateIFrameContent();

        $('.select-group .select li.selected').removeClass('selected');
        const $selected = $(`.select-group .select li[data-val="${bpc.pixiVersionString}"]`);
        $selected.addClass('selected');
        $('.select-group .select .current').text($selected.text());

        $('.main-content').animate({ scrollTop: 0 }, 200);
    };

    bpc.allowedVersions = [8];
    bpc.pixiVersionString = getParameterByName('v') || 'dev';
    bpc.majorPixiVersion = getMajorPixiVersion(bpc.pixiVersionString);

    bpc.exampleUrl = '';
    bpc.exampleFilename = '';
    bpc.exampleTitle = '';
    bpc.exampleSourceCode = '';
    bpc.exampleRequiredPlugins = [];
    bpc.exampleValidVersions = [];

    bpc.editorOptions = {
        mode: 'javascript',
        lineNumbers: true,
        styleActiveLine: true,
        matchBrackets: true,
        viewportMargin: Infinity,
        lineWrapping: true,
    };

    bpc.clickType = 'click';
    bpc.animTime = 0.15;

    bpc.autoPlay = true;
    bpc.packagesManifest = {};

    bpc.browserFeatures = {
        OffscreenCanvas: typeof OffscreenCanvas === 'function',
    };

    bpc.init = function init() {
        const embedded = bpc.embedMode();

        console.log(examplesData);
        examplesData.filter((section) => section.visible !== false).forEach(({ id, title, items }) => {
            let html = `<span class="section" data-section="${id}">${title}</span><ul data-section="${id}">`;
            items.filter((item) => item.visible !== false).forEach((item) => {
                const plugins = typeof item.plugins !== 'undefined' ? item.plugins.join(',') : '';
                const validVersions = typeof item.validVersions !== 'undefined' ? item.validVersions.join(',') : '';
                const features = typeof item.features !== 'undefined' ? item.features.join(',') : '';
                html += `<li data-src="${item.entry}" data-plugins="${plugins}" data-validVersions="${validVersions}" data-features="${features}">${item.title}</li>`;
            });
            html += '</ul>';
            $('.main-menu').append(html);
        });

        bpc.initNav();

        // Ignore branch/versions request from GitHub
        if (embedded) {
            return;
        }
        $.getJSON('https://api.github.com/repos/pixijs/pixi.js/git/refs/tags', (dataTag) => {
            // Filters the tags to only include versions we care about.
            // Only use the last 5 tags per major version
            const maxTagsPerVersion = 5;
            let taggedVersions = [];
            bpc.allowedVersions.forEach((version) => {
                let filtered = dataTag.filter((tag) => tag.ref.indexOf(`refs/tags/v${version}`) === 0);
                if (filtered.length > maxTagsPerVersion) {
                    filtered = filtered.slice(-maxTagsPerVersion);
                }
                taggedVersions = taggedVersions.concat(filtered);
            });

            taggedVersions = taggedVersions.map((tag) => tag.ref.replace('refs/tags/', ''));

            for (let i = 0; i < taggedVersions.length; i++) {
                $('.select-group .select ul').append(`<li data-val="${taggedVersions[i]}">${taggedVersions[i]}</li>`);
            }

            $.getJSON('https://api.github.com/repos/pixijs/pixi.js/git/refs/heads', (dataHead) => {
                // For NEXT version development
                dataHead = dataHead.filter((tag) => tag.ref.indexOf('refs/heads/next') === 0).map((tag) => tag.ref.replace('refs/heads/', ''));

                for (let i = 0; i < dataHead.length; i++) {
                    $('.select-group .select ul').append(`<li data-val="${dataHead[i]}">${dataHead[i]}</li>`);
                }

                const $selected = $(`.select-group .select li[data-val="${bpc.pixiVersionString}"]`);
                $selected.addClass('selected');
                $('.select-group .select .current').text($selected.text());
            });
        });
    };

    bpc.embedMode = function embedMode() {
        // @deprecate lite, use embed instead
        if (!getParameterByName('lite') && !getParameterByName('embed')) {
            return false;
        }
        const $body = $('body');
        const $reload = $('.reload');
        $body.addClass('embed').removeClass('normal');
        $('#redirect').attr('href', window.location.href.replace(window.location.search, ''));
        bpc.autoPlay = !!getParameterByName('autoplay');
        if (bpc.autoPlay) {
            $body.addClass('autoplay');
        } else {
            $reload.on(bpc.clickType, function onClick() {
                $(this).addClass('hidden');
            });
        }
        if (getParameterByName('noredirect')) {
            $body.addClass('noredirect');
        }
        const showcode = getParameterByName('showcode');
        if (!showcode) {
            $body.addClass('nocode');
        } else {
            // Add tab handlers
            const $tabs = $('.main-tab');
            $body.addClass($tabs.filter('.selected').data('view'));
            $tabs.on(bpc.clickType, function onClick() {
                $tabs.removeClass('selected');
                $(this).addClass('selected');
                $tabs.each(function onEach() {
                    $body.removeClass(this.dataset.view);
                });
                $body.addClass(this.dataset.view);
                $reload.addClass('hidden');
                reload();
            });
        }
        return true;
    };

    bpc.initNav = function initNav() {
        $('.main-menu .section').on(bpc.clickType, function onClick() {
            $(this).next('ul').slideToggle(250);
            $(this).toggleClass('open');
        });

        $('.main-menu li').on(bpc.clickType, function onClick() {
            if (!$(this).hasClass('selected')) {
                $('.main-menu li.selected').removeClass('selected');
                $(this).addClass('selected');
                // load data
                bpc.closeMobileNav();

                const page = `/${$(this).parent().attr('data-section')}/${$(this).attr('data-src')}`;
                bpc.exampleTitle = $(this).text();

                window.location.hash = page;
                document.title = `${bpc.exampleTitle} - PixiJS Examples`;

                // Track page change in analytics
                ga('set', { page, title: bpc.exampleTitle });
                ga('send', 'pageview');

                bpc.exampleUrl = `examples/js/${$(this).parent().attr('data-section')}/${$(this).attr('data-src')}`;
                bpc.exampleFilename = $(this).attr('data-src');

                const plugins = $(this).attr('data-plugins');
                bpc.exampleRequiredPlugins = plugins === '' ? [] : plugins.split(',');

                const validVersions = $(this).attr('data-validVersions');
                bpc.exampleValidVersions = validVersions === '' ? [7] : validVersions.split(',').map((v) => parseInt(v, 10));

                const features = $(this).attr('data-features');
                bpc.exampleFeatures = features === '' ? [] : features.split(',');

                $.ajax({
                    url: `examples/js/${$(this).parent().attr('data-section')}/${$(this).attr('data-src')}`,
                    dataType: 'text',
                    success(data) {
                        bpc.exampleSourceCode = data;

                        bpc.loadPackages();
                    },
                });
            }
        });

        bpc.loadPackages = function loadPackages() {
            $.getJSON('examples/packages.json', (data) => {
                bpc.packagesManifest = data;
                if (bpc.autoPlay) {
                    bpc.generateIFrameContent();
                }
            });
        };

        bpc.generateIFrameContent = function generateIFrameContent() {
            const newPackagesManifest = bpc.packagesManifest;

            removeAllIFrames();

            $('#example').html('<iframe id="preview" src="blank.html"></iframe>');

            $('.CodeMirror').remove();
            $('.main-content #code').html(bpc.exampleSourceCode);

            // Generate HTML and insert into iFrame
            let pixiUrl = '';

            if (bpc.pixiVersionString === 'local') {
                pixiUrl = '../dist/gob-pixi.mjs';
            } else { // other versions come from S3
                pixiUrl = `https://d157l7jdn8e5sf.cloudfront.net/${bpc.pixiVersionString}/pixi.mjs`;
            }

            let html = '<!DOCTYPE html><html><head><style>';
            html += 'body,html{margin:0px;height:100%;overflow:hidden;}canvas{width:100%;height:100%;}';
            html += '</style></head><body>';
            html += '<script src="https://code.jquery.com/jquery-3.3.1.min.js"></script>';
            html += `
            <script type="importmap">
              {
                "imports": {
                  "pixi.js": "${pixiUrl}"
                }
              }
            </script>`;
            html += `<script src="${pixiUrl}" type="module"></script>`;
            const exampleRequiredPluginsHTML = [];

            for (let i = 0; i < bpc.exampleRequiredPlugins.length; i++) {
                const pkgName = bpc.exampleRequiredPlugins[i];
                const pkg = newPackagesManifest[pkgName];

                // TODO: Add options to select version of extra packages
                if (pkg) {
                    const basePath = pkg.vendor
                        ? pkg.vendor.replace('{version}', bpc.pixiVersionString)
                        : `https://cdn.jsdelivr.net/npm/${pkgName}@${pkg.version || 'latest'}/`;
                    const src = `${basePath}${pkg.script}`;

                    // New packages manifest pulls from JSDelivr
                    html += `<script src="${src}"></script>`;
                    exampleRequiredPluginsHTML.push(`<a href="${src}">${pkgName}</a>`);
                } else {
                    // Old plugins stored in this repo
                    html += `<script src="pixi-plugins/${bpc.exampleRequiredPlugins[i]}.js"></script>`;
                    exampleRequiredPluginsHTML.push(pkgName);
                }
            }

            bpc.missingFeatures = bpc.exampleFeatures.filter((x) => !bpc.browserFeatures[x]);

            bpc.editor = CodeMirror.fromTextArea(document.getElementById('code'), bpc.editorOptions);

            if (bpc.exampleRequiredPlugins.length) {
                $('#code-header').html(`Example Code (plugins used: ${exampleRequiredPluginsHTML.join(', ')})`);
            } else {
                $('#code-header').text('Example Code');
            }

            if (bpc.exampleValidVersions.length && bpc.exampleValidVersions.indexOf(bpc.majorPixiVersion) === -1) {
                $('#example-title').html(
                    `${bpc.exampleTitle}`
                    + '<br><br><br><br><br><br><br>'
                    + 'The selected version of PixiJS does not work with this example.'
                    + '<br><br>'
                    + `Selected version: v${bpc.majorPixiVersion}`
                    + '<br><br>'
                    + `Required version: v${bpc.exampleValidVersions.toString()}`
                    + '<br><br><br><br><br>',
                );

                $('.example-frame').hide();
            } else if (bpc.missingFeatures.length) {
                $('#example-title').html(
                    `${bpc.exampleTitle}`
                    + '<br><br><br><br><br><br><br>'
                    + 'This example requires some features that your browser doesn\'t support.'
                    + '<br><br>'
                    + `Missing features: ${bpc.missingFeatures.join(', ')}`
                    + '<br><br><br><br><br>',
                );

                $('.example-frame').hide();
            } else {
                $('#example-title').html(bpc.exampleTitle);
                html += `<script type="module">${bpc.exampleSourceCode}</script></body></html>`;

                $('.example-frame').show();
            }

            const iframe = document.getElementById('preview');
            const frameDoc = iframe.contentDocument || iframe.contentWindow.document;

            frameDoc.open();
            frameDoc.write(html);
            frameDoc.close();
        };

        bpc.openMobileNav = function openMobileNav() {
            TweenMax.to('#line1', bpc.animTime, { y: 0, ease: Linear.easeNone });
            TweenMax.to('#line2', 0, { alpha: 0, ease: Linear.easeNone, delay: bpc.animTime });
            TweenMax.to('#line3', bpc.animTime, { y: 0, ease: Linear.easeNone });

            TweenMax.to('#line1', bpc.animTime, { rotation: 45, ease: Quart.easeOut, delay: bpc.animTime });
            TweenMax.to('#line3', bpc.animTime, { rotation: -45, ease: Quart.easeOut, delay: bpc.animTime });

            $('.main-nav').addClass('mobile-open');
        };

        bpc.closeMobileNav = function closeMobileNav() {
            TweenMax.to('#line1', bpc.animTime, { rotation: 0, ease: Linear.easeNone, delay: 0 });
            TweenMax.to('#line3', bpc.animTime, { rotation: 0, ease: Linear.easeNone, delay: 0 });

            TweenMax.to('#line2', 0, { alpha: 1, ease: Quart.easeOut, delay: bpc.animTime });
            TweenMax.to('#line1', bpc.animTime, { y: -8, ease: Quart.easeOut, delay: bpc.animTime });
            TweenMax.to('#line3', bpc.animTime, { y: 8, ease: Quart.easeOut, delay: bpc.animTime });

            $('.main-nav').removeClass('mobile-open');
        };

        bpc.updateMenu = function updateMenu() {
            $('.main-nav .main-menu ul li').each(function updateEachMenuItem() {
                const validVersions = $(this).attr('data-validVersions');
                const exampleValidVersions = validVersions === '' ? [6, 5] : validVersions.split(',').map((v) => parseInt(v, 10));
                if (exampleValidVersions.indexOf(bpc.majorPixiVersion) === -1) {
                    $(this).addClass('invalid');
                } else {
                    $(this).removeClass('invalid');
                }
            });
        };

        bpc.updateMenu();

        $('.main-header .hamburger').on(bpc.clickType, (e) => {
            e.preventDefault();
            if ($('.main-nav').hasClass('mobile-open')) {
                bpc.closeMobileNav();
            } else {
                bpc.openMobileNav();
            }
            return false;
        });

        // Deep link
        if (window.location.hash !== '') {
            const hash = window.location.hash.replace('#/', '');
            const arr = hash.split('/');
            if (arr.length > 1) {
                // Deprecated categories, mesh -> mesh-and-shaders
                if (arr[0] === 'mesh') {
                    // TODO: push it in history
                    arr[0] = 'mesh-and-shaders';
                }

                if ($(`.main-menu .section[data-section="${arr[0]}"]`).length > 0) {
                    $(`.main-menu .section[data-section="${arr[0]}"]`).trigger(bpc.clickType);
                    if ($(`.main-menu .section[data-section="${arr[0]}"]`).next().find(`li[data-src="${arr[1]}"]`).length > 0) {
                        $(`.main-menu .section[data-section="${arr[0]}"]`).next().find(`li[data-src="${arr[1]}"]`).trigger(bpc.clickType);
                    }
                }
            }
        } else {
            $('.main-menu .section').eq(0).trigger(bpc.clickType);
            $('.main-menu li').eq(0).trigger(bpc.clickType);
        }

        // Version control
        $('.select-group').on(bpc.clickType, function onClick() {
            if ($(this).find('.select').hasClass('open')) {
                $(this).find('.select').removeClass('open');
                $(this).find('ul').slideUp(150);
            } else {
                $(this).find('.select').addClass('open');
                $(this).find('ul').slideDown(150);
            }
        });

        $('.select-group .select').on(bpc.clickType, 'li', function onClick() {
            if (!$(this).hasClass('selected')) {
                $('.select-group .select li.selected').removeClass('selected');
                $(this).addClass('selected');
                $('.select-group .select .current').text($(this).text());

                bpc.pixiVersionString = $(this).attr('data-val');
                bpc.majorPixiVersion = getMajorPixiVersion(bpc.pixiVersionString);
                window.history.pushState(bpc.pixiVersionString, null, `?v=${bpc.pixiVersionString}${window.location.hash}`);

                bpc.updateMenu();

                bpc.generateIFrameContent();
                $('.main-content').animate({ scrollTop: 0 }, 200);
            }
        });

        // Download
        $('.footer .download').on(bpc.clickType, () => {
            bpc.saveToDisk(bpc.exampleUrl, bpc.exampleFilename);
        });

        // Refresh Button
        $('.reload').on(bpc.clickType, reload);
    };

    bpc.saveToDisk = function saveToDisk(fileURL, fileName) {
        if (!window.ActiveXObject) { // for non-IE
            const save = document.createElement('a');
            save.href = fileURL;
            save.target = '_blank';
            save.download = fileName || 'unknown';

            const evt = new MouseEvent('click', {
                view: window,
                bubbles: true,
                cancelable: false,
            });
            save.dispatchEvent(evt);

            (window.URL || window.webkitURL).revokeObjectURL(save.href);
        } else if (!!window.ActiveXObject && document.execCommand) { // for IE < 11
            const newWindow = window.open(fileURL, '_blank');
            newWindow.document.close();
            newWindow.document.execCommand('SaveAs', true, fileName || fileURL);
            newWindow.close();
        }
    };

    bpc.init();
});

function removeAllIFrames() {
    // Remove all iFrames and content
    const iframes = document.querySelectorAll('iframe, .frame-placeholder');
    for (let i = 0; i < iframes.length; i++) {
        iframes[i].parentNode.removeChild(iframes[i]);
    }
}
