(() => {
  const config = window.SUBSKU_CONFIG || {};
  let sequence = 0;

  function assertConfigured() {
    if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(config.apiUrl || '')) {
      throw new Error('URL backend belum dikonfigurasi.');
    }
  }

  function jsonp(action, params = {}) {
    assertConfigured();
    return new Promise((resolve, reject) => {
      const callback = `__subsku_${Date.now()}_${++sequence}`;
      const script = document.createElement('script');
      const query = new URLSearchParams({ action, callback });
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
        }
      });
      const cleanup = () => { delete window[callback]; script.remove(); clearTimeout(timer); };
      const timer = setTimeout(() => { cleanup(); reject(new Error('Backend tidak memberi respons. Pastikan anda telah log masuk menggunakan akaun organisasi.')); }, config.requestTimeout || 20000);
      window[callback] = response => {
        cleanup();
        if (!response || response.ok === false) reject(new Error(response?.error || 'Permintaan backend gagal.'));
        else resolve(response.data);
      };
      script.onerror = () => { cleanup(); reject(new Error('Sambungan ke backend gagal.')); };
      script.src = `${config.apiUrl}?${query.toString()}`;
      document.head.appendChild(script);
    });
  }

  function postUpdate(recordId, patch) {
    assertConfigured();
    return new Promise((resolve, reject) => {
      const frameName = `subsku_post_${Date.now()}_${++sequence}`;
      const iframe = document.createElement('iframe');
      iframe.name = frameName;
      iframe.hidden = true;
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = config.apiUrl;
      form.target = frameName;
      form.hidden = true;
      const fields = { action: 'updateRecord', recordId, patch: JSON.stringify(patch) };
      Object.entries(fields).forEach(([name, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden'; input.name = name; input.value = value; form.appendChild(input);
      });
      document.body.append(iframe, form);
      let submitted = false;
      const cleanup = () => { iframe.remove(); form.remove(); };
      iframe.addEventListener('load', async () => {
        if (!submitted) return;
        try {
          await new Promise(r => setTimeout(r, 800));
          const record = await jsonp('record', { recordId });
          const matches = Object.entries(patch).every(([key, value]) => String(record?.[key] ?? '') === String(value ?? ''));
          if (!matches) throw new Error('Kemaskini tidak dapat disahkan. Sila semak akses pentadbir anda.');
          resolve({ ok: true, message: `Rekod ${recordId} telah dikemaskini.`, record });
        } catch (error) { reject(error); }
        finally { cleanup(); }
      });
      submitted = true;
      form.submit();
      setTimeout(() => { if (document.body.contains(form)) { cleanup(); reject(new Error('Kemaskini mengambil masa terlalu lama.')); } }, (config.requestTimeout || 20000) + 5000);
    });
  }

  const methods = {
    getPortalBootstrap: () => jsonp('bootstrap'),
    getRecords: params => jsonp('records', params || {}),
    getAdminPanelData: () => jsonp('adminPanel'),
    updateRecord: (recordId, patch) => postUpdate(recordId, patch)
  };

  window.SubSkuApi = Object.freeze({
    call(name, ...args) {
      if (!methods[name]) return Promise.reject(new Error(`Kaedah API tidak disokong: ${name}`));
      return methods[name](...args);
    }
  });
})();
