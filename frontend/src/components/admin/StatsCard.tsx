'use client'

import React from 'react'
import Link from 'next/link'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { StatsCardProps } from './types'

/**
 * Statistics Card Component
 * 
 * Features:
 * - Icon display
 * - Value with optional formatting
 * - Trend indicator
 * - Optional link
 * - Loading state
 * - Variant colors
 * 
 * @example
 * ```tsx
 * <StatsCard
 *   icon={<Users />}
 *   label="Total Suppliers"
 *   value={totalSuppliers}
 *   trend={{ value: 5, direction: 'up' }}
 *   link="/admin/suppliers"
 * />
 * ```
 */
export default function StatsCard({
  icon,
  label,
  value,
  trend,
  link,
  loading = false,
  variant = 'default'
}: StatsCardProps) {
  const getVariantStyles = () => {
    const styles = {
      default: {
        icon: 'bg-primary-100 text-primary-600',
        border: 'border-primary-200'
      },
      success: {
        icon: 'bg-green-100 text-green-600',
        border: 'border-green-200'
      },
      warning: {
        icon: 'bg-orange-100 text-orange-600',
        border: 'border-orange-200'
      },
      danger: {
        icon: 'bg-red-100 text-red-600',
        border: 'border-red-200'
      }
    }
    return styles[variant]
  }

  const variantStyles = getVariantStyles()

  const getTrendIcon = () => {
    if (!trend) return null
    
    switch (trend.direction) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-600" />
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-600" />
      case 'neutral':
        return <Minus className="w-4 h-4 text-gray-600" />
    }
  }

  const getTrendColor = () => {
    if (!trend) return ''
    
    switch (trend.direction) {
      case 'up':
        return 'text-green-600'
      case 'down':
        return 'text-red-600'
      case 'neutral':
        return 'text-gray-600'
    }
  }

  const CardContent = () => (
    <div className={`bg-white rounded-lg shadow-sm border ${variantStyles.border} p-6 hover:shadow-md transition-shadow duration-200`}>
      <div className="flex items-start justify-between">
        {/* Left Section: Icon & Label */}
        <div className="flex-1">
          {icon && (
            <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg ${variantStyles.icon} mb-4`}>
              {icon}
            </div>
          )}
          
          <p className="text-sm font-medium text-gray-600 mb-1">
            {label}
          </p>
          
          {/* Value */}
          {loading ? (
            <div className="h-8 w-24 bg-gray-200 animate-pulse rounded" />
          ) : (
            <p className="text-3xl font-bold text-gray-900">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
          )}
        </div>

        {/* Right Section: Trend */}
        {trend && !loading && (
          <div className="flex items-center gap-1 text-sm font-medium">
            {getTrendIcon()}
            <span className={getTrendColor()}>
              {trend.value > 0 ? '+' : ''}{trend.value}%
            </span>
          </div>
        )}
      </div>

      {/* Trend Label */}
      {trend?.label && !loading && (
        <p className="text-xs text-gray-500 mt-2">
          {trend.label}
        </p>
      )}
    </div>
  )

  // If link provided, wrap with Link component
  if (link) {
    return (
      <Link href={link} className="block">
        <CardContent />
      </Link>
    )
  }

  return <CardContent />
}

/**
 * Stats Card Grid Layout
 * Responsive grid for multiple stats cards
 */
export function StatsCardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {children}
    </div>
  )
}

/**
 * Loading skeleton for stats cards
 */
export function StatsCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="w-12 h-12 bg-gray-200 animate-pulse rounded-lg mb-4" />
      <div className="h-4 w-24 bg-gray-200 animate-pulse rounded mb-2" />
      <div className="h-8 w-32 bg-gray-200 animate-pulse rounded" />
    </div>
  )
}
