import DictionaryTermsPage from './[...terms]/page'

export default function DictionaryPage() {
  // Pass an empty terms array to the dynamic route component
  return <DictionaryTermsPage params={Promise.resolve({ terms: [] })} />
} 
