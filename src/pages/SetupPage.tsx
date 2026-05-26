import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfigStore } from '@/stores/useConfigStore'
import { Header } from '@/components/layout/Header'
import { Check } from 'lucide-react'
import { isTokenValid, startGoogleAuth, clearGoogleAccessToken } from '@/lib/googleAuth'

const DISABLED_INTEGRATIONS = [
  'Google Docs',
  'Notion',
  'Webflow CMS',
  'RSS Feed',
]

export function SetupPage() {
  const navigate = useNavigate()
  const { config, setConfig, clearConfig } = useConfigStore()

  const [form, setForm] = useState({
    supabaseUrl: config.supabaseUrl,
    supabaseAnonKey: config.supabaseAnonKey,
    openaiKey: config.openaiKey,
    geminiKey: config.geminiKey,
    openrouterKey: config.openrouterKey,
    openrouterModel: config.openrouterModel,
    pexelsKey: config.pexelsKey,
    aiProvider: config.aiProvider,
    instagramHandle: config.instagramHandle,
  })

  // Resync form when stored config changes (e.g. after clearConfig or external update)
  useEffect(() => {
    setForm({
      supabaseUrl: config.supabaseUrl,
      supabaseAnonKey: config.supabaseAnonKey,
      openaiKey: config.openaiKey,
      geminiKey: config.geminiKey,
      openrouterKey: config.openrouterKey,
      openrouterModel: config.openrouterModel,
      pexelsKey: config.pexelsKey,
      aiProvider: config.aiProvider,
      instagramHandle: config.instagramHandle,
    })
  }, [config])

  const [error, setError] = useState('')
  const [driveConnected, setDriveConnected] = useState<boolean>(() => isTokenValid())
  const [folderName, setFolderName] = useState(config.driveConfig?.folderName || 'PostCraft')
  const [subfolderByDate, setSubfolderByDate] = useState<boolean>(
    config.driveConfig?.subfolderByDate ?? true,
  )

  useEffect(() => {
    setFolderName(config.driveConfig?.folderName || 'PostCraft')
    setSubfolderByDate(config.driveConfig?.subfolderByDate ?? true)
  }, [config.driveConfig])

  useEffect(() => {
    const interval = setInterval(() => setDriveConnected(isTokenValid()), 5000)
    return () => clearInterval(interval)
  }, [])

  function handleDisconnectDrive() {
    clearGoogleAccessToken()
    setDriveConnected(false)
  }

  function handleClear() {
    clearConfig()
    setError('')
  }

  function handleChange(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
    setError('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.supabaseUrl || !form.supabaseAnonKey) {
      setError('Supabase URL e Anon Key são obrigatórios.')
      return
    }
    setConfig({
      ...form,
      driveConfig: {
        folderId: config.driveConfig?.folderId ?? '',
        folderName: folderName.trim() || 'PostCraft',
        subfolderByDate,
      },
    })
    navigate('/source')
  }

  return (
    <div className="flex flex-col h-full">
      <Header />
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold text-neutral-900 mb-1">Configuração</h1>
          <p className="text-neutral-500 text-sm mb-8">
            Configure suas conexões e chaves de API para começar.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Supabase */}
            <fieldset className="border border-neutral-200 rounded-xl p-5 space-y-4">
              <legend className="text-xs font-semibold text-neutral-500 uppercase tracking-wide px-1">
                Supabase
              </legend>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-neutral-700">
                  Supabase URL
                </label>
                <input
                  type="text"
                  placeholder="https://xxxx.supabase.co"
                  value={form.supabaseUrl}
                  onChange={(e) => handleChange('supabaseUrl', e.target.value)}
                  className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-neutral-700">
                  Supabase Anon Key
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="eyJhbGci..."
                    value={form.supabaseAnonKey}
                    onChange={(e) => handleChange('supabaseAnonKey', e.target.value)}
                    className="w-full border border-neutral-200 rounded-lg px-3 py-2 pr-16 text-sm outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
                  />
                  {form.supabaseAnonKey && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[11px] font-mono text-green-600">
                      <Check className="w-3 h-3" /> salvo
                    </span>
                  )}
                </div>
              </div>
            </fieldset>

            {/* AI Keys */}
            <fieldset className="border border-neutral-200 rounded-xl p-5 space-y-4">
              <legend className="text-xs font-semibold text-neutral-500 uppercase tracking-wide px-1">
                IA
              </legend>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-neutral-700">
                  OpenAI API Key
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="sk-..."
                    value={form.openaiKey}
                    onChange={(e) => handleChange('openaiKey', e.target.value)}
                    className="w-full border border-neutral-200 rounded-lg px-3 py-2 pr-16 text-sm outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
                  />
                  {form.openaiKey && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[11px] font-mono text-green-600">
                      <Check className="w-3 h-3" /> salvo
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-neutral-700">
                  Gemini API Key
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="AIza..."
                    value={form.geminiKey}
                    onChange={(e) => handleChange('geminiKey', e.target.value)}
                    className="w-full border border-neutral-200 rounded-lg px-3 py-2 pr-16 text-sm outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
                  />
                  {form.geminiKey && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[11px] font-mono text-green-600">
                      <Check className="w-3 h-3" /> salvo
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-neutral-700">
                  Provedor de texto
                </label>
                <div className="flex gap-2">
                  {(['openai', 'gemini', 'openrouter'] as const).map((provider) => (
                    <button
                      key={provider}
                      type="button"
                      onClick={() => handleChange('aiProvider', provider)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                        form.aiProvider === provider
                          ? 'bg-orange-600 text-white border-orange-600'
                          : 'bg-white text-neutral-600 border-neutral-200 hover:border-orange-300'
                      }`}
                    >
                      {provider === 'openai' ? 'OpenAI' : provider === 'gemini' ? 'Gemini' : 'OpenRouter'}
                    </button>
                  ))}
                </div>
              </div>

              {form.aiProvider === 'openrouter' && (
                <>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-neutral-700">
                      OpenRouter API Key
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        placeholder="sk-or-..."
                        value={form.openrouterKey}
                        onChange={(e) => handleChange('openrouterKey', e.target.value)}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-2 pr-16 text-sm outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
                      />
                      {form.openrouterKey && (
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[11px] font-mono text-green-600">
                          <Check className="w-3 h-3" /> salvo
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-neutral-700">
                      Modelo
                    </label>
                    <input
                      type="text"
                      placeholder="google/gemini-flash-1.5"
                      value={form.openrouterModel}
                      onChange={(e) => handleChange('openrouterModel', e.target.value)}
                      className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
                    />
                    <p className="text-[11px] text-neutral-500">
                      Veja todos os modelos em{' '}
                      <a
                        href="https://openrouter.ai/models"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-600 hover:underline"
                      >
                        openrouter.ai/models
                      </a>{' '}
                      — grátis e pagos disponíveis.
                    </p>
                  </div>
                </>
              )}
            </fieldset>

            {/* Mídia */}
            <fieldset className="border border-neutral-200 rounded-xl p-5 space-y-1.5">
              <legend className="text-xs font-semibold text-neutral-500 uppercase tracking-wide px-1">
                Mídia
              </legend>

              <label className="block text-sm font-medium text-neutral-700">
                Pexels API Key{' '}
                <span className="font-normal text-neutral-400">(opcional)</span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="Chave gratuita em pexels.com/api"
                  value={form.pexelsKey}
                  onChange={(e) => handleChange('pexelsKey', e.target.value)}
                  className="w-full border border-neutral-200 rounded-lg px-3 py-2 pr-16 text-sm outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
                />
                {form.pexelsKey && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[11px] font-mono text-green-600">
                    <Check className="w-3 h-3" /> salvo
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">
                Gratuito, sem limite de uso. Habilita fotos reais como fundo das variações.
              </p>
            </fieldset>

            {/* Instagram */}
            <fieldset className="border border-neutral-200 rounded-xl p-5">
              <legend className="text-xs font-semibold text-neutral-500 uppercase tracking-wide px-1">
                Instagram
              </legend>
              <div className="space-y-1.5 mt-2">
                <label className="block text-sm font-medium text-neutral-700">
                  Handle do Instagram
                </label>
                <input
                  type="text"
                  placeholder="@seuperfil"
                  value={form.instagramHandle}
                  onChange={(e) => handleChange('instagramHandle', e.target.value)}
                  className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
                />
              </div>
            </fieldset>

            {/* Google Drive */}
            <fieldset className="border border-neutral-200 rounded-xl p-5 space-y-4">
              <legend className="text-xs font-semibold text-neutral-500 uppercase tracking-wide px-1">
                Google Drive
              </legend>

              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-neutral-700">Conexão</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Salvar imagens, vídeos e legendas organizados por data.
                  </p>
                </div>
                {driveConnected ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-mono text-green-600 flex items-center gap-1">
                      <Check className="w-3 h-3" /> conectado
                    </span>
                    <button
                      type="button"
                      onClick={handleDisconnectDrive}
                      className="text-[11px] text-neutral-400 hover:text-red-500 transition"
                    >
                      desconectar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={startGoogleAuth}
                    className="shrink-0 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold px-3 py-1.5 rounded-md transition"
                  >
                    Conectar Drive
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-neutral-700">
                  Nome da pasta raiz
                </label>
                <input
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="PostCraft"
                  className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={subfolderByDate}
                  onChange={(e) => setSubfolderByDate(e.target.checked)}
                  className="accent-orange-600"
                />
                Organizar em subpastas por data (PostCraft/2026-05-20/Título)
              </label>
            </fieldset>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2.5 rounded-lg transition text-sm"
            >
              Salvar e continuar
            </button>

            <button
              type="button"
              onClick={handleClear}
              className="w-full text-xs text-neutral-400 hover:text-red-500 transition py-1 -mt-2"
            >
              Limpar todas as credenciais
            </button>
          </form>

          {/* Next integrations */}
          <div className="mt-10">
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-3">
              Próximas integrações
            </p>
            <div className="flex flex-wrap gap-2">
              {DISABLED_INTEGRATIONS.map((name) => (
                <span
                  key={name}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-400 border border-neutral-200 cursor-not-allowed"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
