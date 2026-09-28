import type { Banner, BannerTapAction } from '@/data/dummy'

/** Human-readable label for banner tap target (admin table / preview). */
export function getBannerNavigationLabel(b: Partial<Banner>): string {
  const action: BannerTapAction = b.tapAction ?? inferTapAction(b)
  if (action === 'restaurant' && b.restaurantName) {
    return `Restaurant · ${b.restaurantName}`
  }
  if (action === 'web_url' && b.webUrl) {
    return b.webUrl.length > 42 ? `${b.webUrl.slice(0, 42)}…` : b.webUrl
  }
  if (b.link) return b.link
  return 'No navigation'
}

/** Infer tapAction from legacy link field when tapAction is missing. */
export function inferTapAction(b: Partial<Banner>): BannerTapAction {
  if (b.tapAction) return b.tapAction
  if (b.restaurantId) return 'restaurant'
  if (b.webUrl || (b.link && /^https?:\/\//i.test(b.link))) return 'web_url'
  return 'none'
}

/** Build Firestore payload for banner tap navigation. */
export function buildBannerNavigationPayload(form: {
  tapAction: BannerTapAction
  restaurantId: string
  restaurantName: string
  webUrl: string
  legacyLink?: string
}): Pick<Banner, 'tapAction' | 'restaurantId' | 'restaurantName' | 'webUrl' | 'link'> {
  if (form.tapAction === 'restaurant' && form.restaurantId) {
    return {
      tapAction: 'restaurant',
      restaurantId: form.restaurantId,
      restaurantName: form.restaurantName,
      webUrl: null,
      link: `/restaurants/${form.restaurantId}`,
    }
  }
  if (form.tapAction === 'web_url' && form.webUrl.trim()) {
    const url = form.webUrl.trim()
    return {
      tapAction: 'web_url',
      restaurantId: null,
      restaurantName: null,
      webUrl: url,
      link: url,
    }
  }
  return {
    tapAction: 'none',
    restaurantId: null,
    restaurantName: null,
    webUrl: null,
    link: form.legacyLink?.trim() || '',
  }
}
