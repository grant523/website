from django.conf.urls import patterns, url
from seadssite import views as v

urlpatterns = patterns('seadssite',
                       url(r'^$', v.IndexView.as_view()),
                       url(r'^dashboard/$', v.DashboardView),
                       url(r'^register/$', v.register),
                       url(r'^dashboard/[0-9]+/$', 'views.graph', name='graph'),
                       url(r'^dashboard/[0-9]+/appliances/$', v.DevicesView),
                       url(r'^help/$', v.help),)
