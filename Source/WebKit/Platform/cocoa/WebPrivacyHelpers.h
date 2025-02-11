/*
 * Copyright (C) 2022 Apple Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE INC. AND ITS CONTRIBUTORS ``AS IS''
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 * THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL APPLE INC. OR ITS CONTRIBUTORS
 * BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF
 * THE POSSIBILITY OF SUCH DAMAGE.
 */

#pragma once

#import <wtf/CompletionHandler.h>
#import <wtf/Function.h>
#import <wtf/Ref.h>
#import <wtf/RetainPtr.h>
#import <wtf/Vector.h>
#import <wtf/WeakHashSet.h>
#import <wtf/text/WTFString.h>

#if ENABLE(ADVANCED_PRIVACY_PROTECTIONS)
#import <WebCore/LinkDecorationFilteringData.h>
#endif

OBJC_CLASS WKWebPrivacyNotificationListener;
OBJC_CLASS NSURLSession;

namespace WebKit {

#if ENABLE(ADVANCED_PRIVACY_PROTECTIONS)

void configureForAdvancedPrivacyProtections(NSURLSession *);
void requestLinkDecorationFilteringData(CompletionHandler<void(Vector<WebCore::LinkDecorationFilteringData>&&)>&&);

class LinkDecorationFilteringDataObserver : public RefCounted<LinkDecorationFilteringDataObserver>, public CanMakeWeakPtr<LinkDecorationFilteringDataObserver> {
public:
    ~LinkDecorationFilteringDataObserver() = default;

private:
    friend class LinkDecorationFilteringController;

    LinkDecorationFilteringDataObserver(Function<void()>&& callback)
        : m_callback { WTFMove(callback) }
    {
    }

    static Ref<LinkDecorationFilteringDataObserver> create(Function<void()>&& callback)
    {
        return adoptRef(*new LinkDecorationFilteringDataObserver(WTFMove(callback)));
    }

    void invokeCallback() { m_callback(); }

    Function<void()> m_callback;
};

class LinkDecorationFilteringController {
public:
    static LinkDecorationFilteringController& shared();

    const Vector<WebCore::LinkDecorationFilteringData>& cachedStrings() const { return m_cachedStrings; }
    void updateStrings(CompletionHandler<void()>&&);

    Ref<LinkDecorationFilteringDataObserver> observeUpdates(Function<void()>&&);

private:
    LinkDecorationFilteringController() = default;
    void setCachedStrings(Vector<WebCore::LinkDecorationFilteringData>&&);

    RetainPtr<WKWebPrivacyNotificationListener> m_notificationListener;
    Vector<WebCore::LinkDecorationFilteringData> m_cachedStrings;
    WeakHashSet<LinkDecorationFilteringDataObserver> m_observers;
};

void configureForAdvancedPrivacyProtections(NSURLSession *);

#endif // ENABLE(ADVANCED_PRIVACY_PROTECTIONS)

} // namespace WebKit
