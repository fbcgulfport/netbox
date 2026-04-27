from django.core.exceptions import ValidationError
from django.test import RequestFactory, TestCase

from core.models import ObjectType
from netbox.api.serializers import NetBoxModelSerializer, WritableNestedSerializer
from netbox.tests.dummy_plugin.models import DummyNetBoxModel
from users.models import ObjectPermission, User


class NestedDummyNetBoxModelSerializer(NetBoxModelSerializer):
    class Meta:
        model = DummyNetBoxModel
        fields = ['id', 'url', 'display_url', 'display']
        brief_fields = ['id', 'display']


class WritableNestedDummyNetBoxModelSerializer(WritableNestedSerializer):
    class Meta:
        model = DummyNetBoxModel
        fields = ['id', 'display']


class NestedRelatedObjectPermissionTest(TestCase):
    """
    Validate that nested related-object resolution honors object permissions.

    This exercises the shared serializer behavior directly rather than relying
    on any specific app's API endpoint.
    """

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username='testuser')

        cls.visible_object = DummyNetBoxModel.objects.create()
        cls.hidden_object = DummyNetBoxModel.objects.create()

        obj_perm = ObjectPermission(
            name='View visible dummy object', actions=['view'], constraints={'pk': cls.visible_object.pk}
        )
        obj_perm.save()
        obj_perm.users.add(cls.user)
        obj_perm.object_types.add(ObjectType.objects.get_for_model(DummyNetBoxModel))

    def setUp(self):
        self.request = RequestFactory().get('/api/')
        self.request.user = self.user

    def test_nested_serializer_represents_visible_object(self):
        serializer = NestedDummyNetBoxModelSerializer(nested=True, context={'request': self.request})

        data = serializer.to_representation(self.visible_object)

        self.assertEqual(data['id'], self.visible_object.pk)
        self.assertIn('display', data)

    def test_nested_serializer_redacts_hidden_object(self):
        serializer = NestedDummyNetBoxModelSerializer(nested=True, context={'request': self.request})

        data = serializer.to_representation(self.hidden_object)

        self.assertEqual(data, {'id': self.hidden_object.pk})

    def test_writable_nested_serializer_represents_visible_object(self):
        serializer = WritableNestedDummyNetBoxModelSerializer(context={'request': self.request})

        data = serializer.to_representation(self.visible_object)

        self.assertEqual(data['id'], self.visible_object.pk)
        self.assertIn('display', data)

    def test_writable_nested_serializer_redacts_hidden_object(self):
        serializer = WritableNestedDummyNetBoxModelSerializer(context={'request': self.request})

        data = serializer.to_representation(self.hidden_object)

        self.assertEqual(data, {'id': self.hidden_object.pk})

    def test_nested_serializer_resolves_visible_object_by_id(self):
        serializer = NestedDummyNetBoxModelSerializer(nested=True, context={'request': self.request})

        self.assertEqual(serializer.to_internal_value(self.visible_object.pk), self.visible_object)

    def test_nested_serializer_rejects_hidden_object_by_id(self):
        serializer = NestedDummyNetBoxModelSerializer(nested=True, context={'request': self.request})

        with self.assertRaises(ValidationError):
            serializer.to_internal_value(self.hidden_object.pk)

    def test_nested_serializer_rejects_hidden_object_by_attrs(self):
        serializer = NestedDummyNetBoxModelSerializer(nested=True, context={'request': self.request})

        with self.assertRaises(ValidationError):
            serializer.to_internal_value({'id': self.hidden_object.pk})

    def test_writable_nested_serializer_resolves_visible_object_by_id(self):
        serializer = WritableNestedDummyNetBoxModelSerializer(context={'request': self.request})

        self.assertEqual(serializer.to_internal_value(self.visible_object.pk), self.visible_object)

    def test_writable_nested_serializer_rejects_hidden_object_by_id(self):
        serializer = WritableNestedDummyNetBoxModelSerializer(context={'request': self.request})

        with self.assertRaises(ValidationError):
            serializer.to_internal_value(self.hidden_object.pk)

    def test_writable_nested_serializer_rejects_hidden_object_by_attrs(self):
        serializer = WritableNestedDummyNetBoxModelSerializer(context={'request': self.request})

        with self.assertRaises(ValidationError):
            serializer.to_internal_value({'id': self.hidden_object.pk})

    def test_nested_serializer_resolves_object_without_request_context(self):
        serializer = NestedDummyNetBoxModelSerializer(nested=True)

        self.assertEqual(serializer.to_internal_value(self.hidden_object.pk), self.hidden_object)

    def test_writable_nested_serializer_resolves_object_without_request_context(self):
        serializer = WritableNestedDummyNetBoxModelSerializer()

        self.assertEqual(serializer.to_internal_value(self.hidden_object.pk), self.hidden_object)
