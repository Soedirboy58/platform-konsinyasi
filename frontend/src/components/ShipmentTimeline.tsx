'use client'

import { Clock, Package, Truck, CheckCircle, XCircle } from 'lucide-react'

type ShipmentStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED'

type TimelineStep = {
  label: string
  icon: any
  status: 'completed' | 'current' | 'upcoming' | 'rejected'
}

type ShipmentTimelineProps = {
  currentStatus: ShipmentStatus
  createdAt?: string
  approvedAt?: string
  completedAt?: string
  rejectionReason?: string
}

export default function ShipmentTimeline({ 
  currentStatus, 
  createdAt, 
  approvedAt, 
  completedAt,
  rejectionReason 
}: ShipmentTimelineProps) {
  
  const getSteps = (): TimelineStep[] => {
    if (currentStatus === 'REJECTED') {
      return [
        {
          label: 'Pengajuan Dibuat',
          icon: Package,
          status: 'completed'
        },
        {
          label: 'Ditolak',
          icon: XCircle,
          status: 'rejected'
        }
      ]
    }

    if (currentStatus === 'CANCELLED') {
      return [
        {
          label: 'Pengajuan Dibuat',
          icon: Package,
          status: 'completed'
        },
        {
          label: 'Dibatalkan',
          icon: XCircle,
          status: 'rejected'
        }
      ]
    }

    return [
      {
        label: 'Pengajuan Dibuat',
        icon: Package,
        status: 'completed'
      },
      {
        label: 'Dalam Review',
        icon: Clock,
        status: currentStatus === 'PENDING' ? 'current' : 'completed'
      },
      {
        label: 'Disetujui',
        icon: Truck,
        status: currentStatus === 'APPROVED' || currentStatus === 'COMPLETED' ? 'completed' : 'upcoming'
      },
      {
        label: 'Diterima',
        icon: CheckCircle,
        status: currentStatus === 'COMPLETED' ? 'completed' : 'upcoming'
      }
    ]
  }

  const steps = getSteps()

  const getStepColor = (status: TimelineStep['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500 border-green-500'
      case 'current':
        return 'bg-blue-500 border-blue-500 animate-pulse'
      case 'rejected':
        return 'bg-red-500 border-red-500'
      case 'upcoming':
        return 'bg-gray-200 border-gray-300'
    }
  }

  const getLineColor = (index: number) => {
    const currentStep = steps[index]
    const nextStep = steps[index + 1]
    
    if (currentStep.status === 'completed' && nextStep?.status === 'completed') {
      return 'bg-green-500'
    }
    if (currentStep.status === 'completed' && nextStep?.status === 'current') {
      return 'bg-gradient-to-r from-green-500 to-blue-500'
    }
    if (currentStep.status === 'rejected') {
      return 'bg-red-500'
    }
    return 'bg-gray-200'
  }

  const getTextColor = (status: TimelineStep['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-600'
      case 'current':
        return 'text-blue-600 font-semibold'
      case 'rejected':
        return 'text-red-600 font-semibold'
      case 'upcoming':
        return 'text-gray-400'
    }
  }

  const getIconColor = (status: TimelineStep['status']) => {
    switch (status) {
      case 'completed':
        return 'text-white'
      case 'current':
        return 'text-white'
      case 'rejected':
        return 'text-white'
      case 'upcoming':
        return 'text-gray-400'
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return null
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStepDate = (index: number) => {
    if (index === 0 && createdAt) return formatDate(createdAt)
    if (index === 2 && approvedAt) return formatDate(approvedAt)
    if (index === 3 && completedAt) return formatDate(completedAt)
    return null
  }

  return (
    <div className="py-4">
      {/* Timeline Container */}
      <div className="relative">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center flex-1">
              {/* Step Circle */}
              <div className="flex flex-col items-center">
                <div className={`
                  w-12 h-12 rounded-full border-4 flex items-center justify-center
                  transition-all duration-300 z-10
                  ${getStepColor(step.status)}
                `}>
                  <step.icon className={`w-6 h-6 ${getIconColor(step.status)}`} />
                </div>
                
                {/* Label */}
                <p className={`
                  mt-2 text-sm text-center whitespace-nowrap
                  ${getTextColor(step.status)}
                `}>
                  {step.label}
                </p>

                {/* Date */}
                {getStepDate(index) && (
                  <p className="mt-1 text-xs text-gray-500">
                    {getStepDate(index)}
                  </p>
                )}
              </div>

              {/* Connecting Line */}
              {index < steps.length - 1 && (
                <div className="flex-1 mx-2">
                  <div className={`
                    h-1 rounded-full transition-all duration-300
                    ${getLineColor(index)}
                  `} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Rejection Reason (if rejected) */}
      {currentStatus === 'REJECTED' && rejectionReason && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm font-semibold text-red-800 mb-1">Alasan Penolakan:</p>
          <p className="text-sm text-red-700">{rejectionReason}</p>
        </div>
      )}

      {/* Current Status Badge */}
      <div className="mt-6 flex justify-center">
        {currentStatus === 'PENDING' && (
          <div className="px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-full">
            <p className="text-sm text-yellow-800 font-medium">
              ⏳ Menunggu Review Admin
            </p>
          </div>
        )}
        {currentStatus === 'APPROVED' && (
          <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-full">
            <p className="text-sm text-green-800 font-medium">
              ✅ Disetujui - Dalam Pengiriman
            </p>
          </div>
        )}
        {currentStatus === 'COMPLETED' && (
          <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-full">
            <p className="text-sm text-blue-800 font-medium">
              🎉 Pengiriman Selesai
            </p>
          </div>
        )}
        {currentStatus === 'REJECTED' && (
          <div className="px-4 py-2 bg-red-50 border border-red-200 rounded-full">
            <p className="text-sm text-red-800 font-medium">
              ❌ Pengajuan Ditolak
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
