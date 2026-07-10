import { ModuleHeader, EmptyState } from '@/shared/components'
import { BookOpen } from 'lucide-react'

export function KnowledgePage() {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <ModuleHeader
        title="Base de Conocimiento"
        description="Repositorio de contexto territorial, marcos normativos y conocimiento institucional."
      />
      <EmptyState
        icon={<BookOpen className="h-8 w-8" />}
        title="Módulo en preparación"
        description="La base de conocimiento alimentará el contexto del Copilot para interpretaciones más precisas."
        className="flex-1"
      />
    </div>
  )
}
