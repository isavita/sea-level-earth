import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { loadCountries, type CountryFeature } from '../lib/countries'
import type { CountryRisk } from '../lib/landLoss'

interface CountriesContextValue {
  features: CountryFeature[]
  riskById: Map<string, CountryRisk>
  sourceNote: string
  loading: boolean
  getById: (id: string) => CountryFeature | undefined
}

const CountriesContext = createContext<CountriesContextValue | null>(null)

export function CountriesProvider({ children }: { children: ReactNode }) {
  const [features, setFeatures] = useState<CountryFeature[]>([])
  const [riskById, setRiskById] = useState<Map<string, CountryRisk>>(new Map())
  const [sourceNote, setSourceNote] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    loadCountries()
      .then((d) => {
        if (cancelled) return
        setFeatures(d.features)
        setRiskById(d.riskById)
        setSourceNote(d.sourceNote)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo(
    () => ({
      features,
      riskById,
      sourceNote,
      loading,
      getById: (id: string) => features.find((f) => f.properties.id === id),
    }),
    [features, riskById, sourceNote, loading],
  )

  return (
    <CountriesContext.Provider value={value}>
      {children}
    </CountriesContext.Provider>
  )
}

export function useCountries() {
  const ctx = useContext(CountriesContext)
  if (!ctx) throw new Error('useCountries requires CountriesProvider')
  return ctx
}
